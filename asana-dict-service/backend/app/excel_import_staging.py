"""
Staging импорта Excel: строки в PostgreSQL до применения к OWL.
Парсинг и запись в import_staging_rows без блокировки OWL — параллельно для разных загрузок.
Применение к онтологии — под Redis lock + lease (последовательно).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.excel_import import (
    materialize_embedded_photos_to_staging_payload,
    normalize_column_names,
    parse_excel_file,
    run_asana_names_indexed_rows,
    run_asanas_indexed_rows,
    run_full_indexed_rows,
)
from app.models import ImportBatch, ImportStagingRow

logger = logging.getLogger("asana_service.excel_import_staging")


_STAGING_COMMIT_EVERY = 40


def ingest_excel_to_staging(
    file_path: str,
    mode: str,
    user: str,
    source_id: Optional[str] = None,
    source_mapping: Optional[Dict[str, str]] = None,
    staging_progress_callback: Optional[Callable[[int, int], None]] = None,
) -> int:
    """
    Парсит Excel, нормализует строки, пишет в import_batches + import_staging_rows.
    Не трогает OWL. Возвращает batch_id.
    """
    from app.main import SessionLocal

    rows = parse_excel_file(file_path)
    session = SessionLocal()
    try:
        batch = ImportBatch(
            user=user,
            mode=mode,
            source_id=source_id,
            source_mapping=source_mapping,
            status="staged",
            total_rows=len(rows),
            created_at=datetime.now().isoformat(),
        )
        session.add(batch)
        session.flush()
        batch_id = batch.id
        total = len(rows)
        step = max(1, total // 25) if total else 1
        for i, row in enumerate(rows):
            idx = i + 2
            normalized = normalize_column_names(row)
            normalized = materialize_embedded_photos_to_staging_payload(normalized)
            session.add(
                ImportStagingRow(batch_id=batch_id, row_number=idx, payload=normalized)
            )
            if staging_progress_callback and total and (i % step == 0 or i == total - 1):
                staging_progress_callback(i + 1, total)
            if (i + 1) % _STAGING_COMMIT_EVERY == 0:
                session.commit()
        session.commit()
        logger.info("Staging: batch_id=%s mode=%s rows=%s", batch_id, mode, len(rows))
        return batch_id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def apply_import_batch(
    batch_id: int,
    user: str,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> Dict[str, Any]:
    """
    Читает строки staging, применяет к онтологии. Вызывать только под OWL-lock.
    """
    from app.main import SessionLocal

    session = SessionLocal()
    try:
        batch = session.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            raise ValueError(f"import batch {batch_id} not found")

        q = (
            session.query(ImportStagingRow)
            .filter(ImportStagingRow.batch_id == batch_id)
            .order_by(ImportStagingRow.row_number)
        )
        rows_db = q.all()
        indexed: List[Tuple[int, Dict[str, Any]]] = [
            (r.row_number, dict(r.payload) if isinstance(r.payload, dict) else {})
            for r in rows_db
        ]

        batch.status = "applying"
        session.commit()

        if batch.mode == "asanas":
            if not batch.source_id:
                raise ValueError("asanas batch requires source_id")
            result = run_asanas_indexed_rows(
                indexed, batch.source_id, user=user, progress_callback=progress_callback
            )
        elif batch.mode == "full":
            result = run_full_indexed_rows(
                indexed,
                user=user,
                progress_callback=progress_callback,
                source_mapping=batch.source_mapping,
            )
        elif batch.mode == "names":
            result = run_asana_names_indexed_rows(indexed, user=user)
        else:
            raise ValueError(f"unknown import batch mode: {batch.mode}")

        batch.status = "completed"
        session.query(ImportStagingRow).filter(ImportStagingRow.batch_id == batch_id).delete()
        session.commit()
        return result
    except Exception:
        session.rollback()
        try:
            b = session.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
            if b:
                b.status = "failed"
                session.commit()
        except Exception:
            session.rollback()
        raise
    finally:
        session.close()
