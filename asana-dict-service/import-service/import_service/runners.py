"""Фоновые задачи импорта Excel (используют task_storage для Redis)."""
import logging
import os
import time
from typing import Dict, Optional

from app.catalog_sync import acquire_owl_write_lease, release_owl_write_lease_and_resync
from import_service.task_storage import (
    OWL_WRITE_BUSY_DETAIL,
    release_owl_write_lock,
    task_update,
    touch_owl_write_lock,
    try_acquire_owl_write_lock,
)

logger = logging.getLogger("asana_service.import_runners")

# В ответ клиенту отдаём все сообщения, но с потолком — очень длинные списки раздувают Redis/JSON.
_MAX_IMPORT_ERRORS_IN_RESPONSE = 5000


def _ingest_progress_callbacks(task_id: str):
    """
    Две фазы до 10%: чтение/разбор Excel (2–4%) и staging+S3 (4–9%).
    Раньше весь parse_excel_file шёл без обновлений — на проде казалось «зависание на 2%».
    """

    def on_parse(cur: int, total: int) -> None:
        if total <= 0:
            return
        # Без int(): иначе при большом total долго «липнем» на 2% (как раньше на staging к 4%).
        frac = min(1.0, max(0.0, cur / max(total, 1)))
        p = round(2.0 + frac * 2.0, 2)
        task_update(task_id, progress=min(4.0, max(2.0, p)))

    def on_staging(cur: int, total: int, within_row: float = 0.0) -> None:
        if total <= 0:
            return
        w = min(max(within_row, 0.0), 0.999)
        frac = min(1.0, max(0.0, (cur + w) / max(total, 1)))
        p = round(4.0 + frac * 5.0, 2)
        task_update(task_id, progress=min(9.0, max(4.0, p)))

    return on_parse, on_staging


def _wait_owl_redis_lock(task_id: str, max_seconds: int = 7200) -> bool:
    """Ждём Redis-блокировку записи OWL без 409 пользователю (staging уже в БД)."""
    deadline = time.time() + max_seconds
    while time.time() < deadline:
        if try_acquire_owl_write_lock(task_id):
            return True
        task_update(task_id, status="processing", progress=5)
        time.sleep(1.5)
    return False


def _errors_payload(errors: list) -> dict:
    raw = errors or []
    total = len(raw)
    if total <= _MAX_IMPORT_ERRORS_IN_RESPONSE:
        return {"errors": raw, "errors_total": total, "errors_truncated": False}
    return {
        "errors": raw[:_MAX_IMPORT_ERRORS_IN_RESPONSE],
        "errors_total": total,
        "errors_truncated": True,
    }


def run_import_asanas_task(task_id: str, tmp_path: str, source_id: str, user: str) -> None:
    from app.excel_import_staging import apply_import_batch, ingest_excel_to_staging
    from app.main import SessionLocal

    batch_id = None
    try:
        task_update(task_id, status="processing", progress=2)

        on_parse, on_staging = _ingest_progress_callbacks(task_id)

        batch_id = ingest_excel_to_staging(
            tmp_path,
            mode="asanas",
            user=user,
            source_id=source_id,
            staging_progress_callback=on_staging,
            parse_progress_callback=on_parse,
        )
        task_update(task_id, status="processing", progress=10, batch_id=batch_id)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            tmp_path = ""

        if not _wait_owl_redis_lock(task_id):
            task_update(task_id, status="error", error="Таймаут ожидания записи в онтологию (очередь)")
            return

        db_lease = SessionLocal()
        try:
            acquire_owl_write_lease(db_lease)
        finally:
            db_lease.close()

        def update_progress(current: int, total: int) -> None:
            if total > 0:
                frac = min(1.0, max(0.0, current / float(total)))
                progress = round(10.0 + frac * 85.0, 2)
                task_update(task_id, progress=min(99.0, max(10.0, progress)))
                logger.debug("Import progress: %s%% (%s/%s)", progress, current, total)
                if current > 0 and current % 100 == 0:
                    touch_owl_write_lock(task_id)

        result = apply_import_batch(batch_id, user=user, progress_callback=update_progress)
        err_list = result.get("errors", []) or []
        error_count = len(err_list)
        ep = _errors_payload(err_list)

        task_update(
            task_id,
            status="completed",
            progress=100,
            result={
                "imported": result.get("imported", 0),
                "moderation_inserted": result.get("moderation_inserted", 0),
                "moderation_merged": result.get("moderation_merged", 0),
                "moderation_skipped": result.get("moderation_skipped", 0),
                "moderation_save_errors": result.get("moderation_save_errors", 0),
                "skipped_identical_in_catalog": result.get("skipped_identical_in_catalog", 0),
                "rows_processed": result.get("rows_processed", 0),
                "errors_count": error_count,
                "errors": ep["errors"],
                "errors_total": ep["errors_total"],
                "errors_truncated": ep["errors_truncated"],
                "batch_id": batch_id,
            },
        )
    except Exception as e:
        task_update(task_id, status="error", error=str(e))
        logger.error("Error in import task %s: %s", task_id, e, exc_info=True)
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
    finally:
        release_owl_write_lock(task_id)
        release_owl_write_lease_and_resync()


def run_import_full_task(
    task_id: str, tmp_path: str, user: str, source_mapping: Optional[Dict[str, str]] = None
) -> None:
    from app.excel_import_staging import apply_import_batch, ingest_excel_to_staging
    from app.main import SessionLocal

    batch_id = None
    try:
        task_update(task_id, status="processing", progress=2)

        on_parse, on_staging = _ingest_progress_callbacks(task_id)

        batch_id = ingest_excel_to_staging(
            tmp_path,
            mode="full",
            user=user,
            source_mapping=source_mapping,
            staging_progress_callback=on_staging,
            parse_progress_callback=on_parse,
        )
        task_update(task_id, status="processing", progress=10, batch_id=batch_id)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            tmp_path = ""

        if not _wait_owl_redis_lock(task_id):
            task_update(task_id, status="error", error="Таймаут ожидания записи в онтологию (очередь)")
            return

        db_lease = SessionLocal()
        try:
            acquire_owl_write_lease(db_lease)
        finally:
            db_lease.close()

        def update_progress(current: int, total: int) -> None:
            if total > 0:
                frac = min(1.0, max(0.0, current / float(total)))
                progress = round(10.0 + frac * 85.0, 2)
                task_update(task_id, progress=min(99.0, max(10.0, progress)))
                logger.debug("Import progress: %s%% (%s/%s)", progress, current, total)
                if current > 0 and current % 100 == 0:
                    touch_owl_write_lock(task_id)

        result = apply_import_batch(batch_id, user=user, progress_callback=update_progress)
        err_list = result.get("errors", []) or []
        error_count = len(err_list)
        ep = _errors_payload(err_list)

        task_update(
            task_id,
            status="completed",
            progress=100,
            result={
                "imported_asanas": result.get("imported_asanas", 0),
                "imported_sources": result.get("imported_sources", 0),
                "moderation_inserted": result.get("moderation_inserted", 0),
                "moderation_merged": result.get("moderation_merged", 0),
                "moderation_skipped": result.get("moderation_skipped", 0),
                "moderation_save_errors": result.get("moderation_save_errors", 0),
                "skipped_identical_in_catalog": result.get("skipped_identical_in_catalog", 0),
                "rows_processed": result.get("rows_processed", 0),
                "errors_count": error_count,
                "errors": ep["errors"],
                "errors_total": ep["errors_total"],
                "errors_truncated": ep["errors_truncated"],
                "batch_id": batch_id,
            },
        )
    except Exception as e:
        task_update(task_id, status="error", error=str(e))
        logger.error("Error in import task %s: %s", task_id, e, exc_info=True)
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
    finally:
        release_owl_write_lock(task_id)
        release_owl_write_lease_and_resync()
