"""
Метаданные названий асан в PostgreSQL (вне OWL).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from rdflib import URIRef, RDF
from sqlalchemy.orm import Session

logger = logging.getLogger("asana_service.name_metadata")

_NAME_CREATED_AT_PRED = URIRef(
    "http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#nameCreatedAt"
)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_session():
    from app.main import SessionLocal

    return SessionLocal()


def start_name_import_batch(user: Optional[str] = None) -> int:
    from app.models import NameImportBatch

    db = _db_session()
    try:
        row = NameImportBatch(created_at=_utc_iso(), user=user, imported_count=0)
        db.add(row)
        db.commit()
        db.refresh(row)
        return int(row.id)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def finish_name_import_batch(batch_id: int, imported_count: int) -> None:
    from app.models import NameImportBatch

    db = _db_session()
    try:
        row = db.query(NameImportBatch).filter(NameImportBatch.id == batch_id).first()
        if not row:
            return
        row.imported_count = int(imported_count or 0)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_latest_name_import_batch_id() -> Optional[int]:
    from app.models import NameImportBatch

    db = _db_session()
    try:
        row = (
            db.query(NameImportBatch)
            .filter(NameImportBatch.imported_count > 0)
            .order_by(NameImportBatch.id.desc())
            .first()
        )
        return int(row.id) if row else None
    finally:
        db.close()


def record_asana_name_created(
    name_uri: str,
    created_at: Optional[str] = None,
    import_batch_id: Optional[int] = None,
) -> None:
    from app.models import AsanaNameMeta

    uri = str(name_uri).strip()
    if not uri:
        return
    ts = (created_at or _utc_iso()).strip()
    db = _db_session()
    try:
        existing = db.query(AsanaNameMeta).filter(AsanaNameMeta.uri == uri).first()
        if existing:
            if import_batch_id is not None and existing.import_batch_id is None:
                existing.import_batch_id = import_batch_id
                db.commit()
            return
        db.add(
            AsanaNameMeta(
                uri=uri,
                created_at=ts,
                import_batch_id=import_batch_id,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_asana_name_metadata(name_uri: str) -> None:
    from app.models import AsanaNameMeta

    uri = str(name_uri).strip()
    if not uri:
        return
    db = _db_session()
    try:
        db.query(AsanaNameMeta).filter(AsanaNameMeta.uri == uri).delete()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def attach_name_metadata(names: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not names:
        return names
    from app.models import AsanaNameMeta

    ids = [n["id"] for n in names if n.get("id")]
    if not ids:
        return names
    db = _db_session()
    try:
        rows = db.query(AsanaNameMeta).filter(AsanaNameMeta.uri.in_(ids)).all()
        meta = {row.uri: row for row in rows}
        for item in names:
            row = meta.get(item.get("id"))
            item["name_created_at"] = row.created_at if row else None
            item["import_batch_id"] = row.import_batch_id if row else None
        return names
    finally:
        db.close()


def migrate_name_created_at_from_owl_to_db(session: Session) -> int:
    """
    Однократный перенос legacy nameCreatedAt из OWL в PostgreSQL и удаление триплетов.
    """
    from app.models import AsanaNameMeta
    from app.ontology import ASANA, get_graph, invalidate_ontology_cache, _persist_ontology_graph

    g = get_graph()
    moved = 0
    dirty_graph = False
    for name in list(g.subjects(RDF.type, ASANA.AsanaName)):
        created = g.value(name, _NAME_CREATED_AT_PRED)
        if not created:
            continue
        uri = str(name)
        ts = str(created)
        if not session.query(AsanaNameMeta).filter(AsanaNameMeta.uri == uri).first():
            session.add(AsanaNameMeta(uri=uri, created_at=ts, import_batch_id=None))
        g.remove((name, _NAME_CREATED_AT_PRED, created))
        moved += 1
        dirty_graph = True
    if moved:
        session.flush()
        if dirty_graph:
            _persist_ontology_graph(g)
            invalidate_ontology_cache()
        logger.info("name_metadata: перенесено nameCreatedAt из OWL в БД: %s", moved)
    return moved
