"""
Синхронизация OWL → PostgreSQL (зеркало каталога).
Пока идёт запись в онтологию (импорт, загрузка OWL), write_lease_count > 0 — синк не трогает файл и не перезаписывает зеркало.
"""
from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from app import config

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger("asana_service.catalog_sync")

SYNC_STATE_ID = 1
_background_thread: Optional[threading.Thread] = None
_background_stop = threading.Event()


def _utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ensure_catalog_sync_state_row(session: "Session") -> None:
    from app.models import CatalogSyncState

    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).first()
    if not row:
        session.add(
            CatalogSyncState(
                id=SYNC_STATE_ID,
                write_lease_count=0,
                last_owl_to_db_at=None,
                last_owl_sha256=None,
            )
        )
        session.commit()
        logger.info("catalog_sync_state: создана строка id=1")


def acquire_owl_write_lease(session: "Session") -> None:
    """Вызывать при старте любой операции, которая меняет OWL (импорт, upload OWL)."""
    from app.models import CatalogSyncState

    ensure_catalog_sync_state_row(session)
    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).with_for_update().one()
    row.write_lease_count = (row.write_lease_count or 0) + 1
    session.commit()
    logger.debug("OWL write lease acquired, count=%s", row.write_lease_count)


def release_owl_write_lease(session: "Session") -> None:
    """Вызывать в finally после завершения операции с OWL."""
    from app.models import CatalogSyncState

    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).with_for_update().first()
    if not row:
        session.rollback()
        return
    row.write_lease_count = max(0, (row.write_lease_count or 0) - 1)
    session.commit()
    logger.debug("OWL write lease released, count=%s", row.write_lease_count)


def is_catalog_sync_paused(session: "Session") -> bool:
    from app.models import CatalogSyncState

    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).first()
    if not row:
        return False
    return (row.write_lease_count or 0) > 0


def _owl_file_sha256() -> Optional[str]:
    path = config.OWL_FILE_PATH
    if not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_owl_to_postgres_sync(session: "Session") -> bool:
    """
    Полная пересборка зеркала каталога из текущего OWL.
    Возвращает True, если синк выполнен; False, если пропущен (пауза или выключено).
    """
    from app.models import CatalogMirrorItem, CatalogSyncState

    if os.getenv("CATALOG_SYNC_ENABLED", "true").lower() not in ("1", "true", "yes"):
        return False

    ensure_catalog_sync_state_row(session)
    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).first()
    if not row:
        session.rollback()
        return False
    if (row.write_lease_count or 0) > 0:
        session.rollback()
        logger.info("Синхронизация OWL→БД пропущена: активна запись в онтологию (lease>0)")
        return False

    mirror_count = session.query(CatalogMirrorItem).count()
    if mirror_count > 0:
        # DB-first: зеркало ведётся при каждой persist_ontology_graph; не перезаписываем из файла.
        sha = _owl_file_sha256()
        row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).with_for_update().one()
        row.last_owl_sha256 = sha
        row.last_owl_to_db_at = _utc_iso()
        session.commit()
        logger.debug("OWL→БД: зеркало уже заполнено (DB-first), обновлён только sha")
        return False

    sha = _owl_file_sha256()
    if sha and row.last_owl_sha256 == sha:
        session.rollback()
        logger.debug("Синхронизация OWL→БД пропущена: файл не менялся")
        return False

    row = session.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).with_for_update().one()
    if (row.write_lease_count or 0) > 0:
        session.rollback()
        logger.info("Синхронизация OWL→БД пропущена: появилась запись в онтологию во время проверки")
        return False

    from app.ontology import load_asana_names, load_asanas, load_sources

    names = load_asana_names()
    sources = load_sources()
    asanas = load_asanas()

    session.query(CatalogMirrorItem).delete()
    for n in names:
        uri = n.get("id")
        if not uri:
            continue
        session.add(CatalogMirrorItem(uri=uri, entity_type="AsanaName", payload=n))
    for s in sources:
        uri = s.get("id")
        if not uri:
            continue
        session.add(CatalogMirrorItem(uri=uri, entity_type="AsanaSource", payload=s))
    for a in asanas:
        uri = a.get("id")
        if not uri:
            continue
        session.add(CatalogMirrorItem(uri=uri, entity_type="Asana", payload=a))

    row.last_owl_to_db_at = _utc_iso()
    row.last_owl_sha256 = sha
    session.commit()
    logger.info(
        "Синхронизация OWL→БД завершена: имён=%s источников=%s асан=%s",
        len(names),
        len(sources),
        len(asanas),
    )
    return True


def run_sync_with_new_session():
    """Для фонового потока: отдельная сессия БД."""
    from app.main import SessionLocal

    if SessionLocal is None:
        return
    db = SessionLocal()
    try:
        run_owl_to_postgres_sync(db)
    except Exception as e:
        logger.error("Ошибка синхронизации OWL→БД: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _background_loop(interval_sec: float) -> None:
    while not _background_stop.wait(timeout=interval_sec):
        run_sync_with_new_session()


def start_catalog_sync_background_thread() -> None:
    """Запускает демон-поток периодической синхронизации (один раз на процесс)."""
    global _background_thread
    if os.getenv("CATALOG_SYNC_BACKGROUND", "true").lower() not in ("1", "true", "yes"):
        logger.info("Фоновый поток синхронизации не запускается (CATALOG_SYNC_BACKGROUND=false)")
        return
    if os.getenv("CATALOG_SYNC_ENABLED", "true").lower() not in ("1", "true", "yes"):
        logger.info("Фоновая синхронизация каталога отключена (CATALOG_SYNC_ENABLED)")
        return
    if _background_thread is not None and _background_thread.is_alive():
        return
    try:
        interval = float(os.getenv("CATALOG_SYNC_INTERVAL_SEC", "120"))
    except ValueError:
        interval = 120.0
    _background_stop.clear()
    _background_thread = threading.Thread(
        target=_background_loop,
        args=(interval,),
        name="catalog-sync",
        daemon=True,
    )
    _background_thread.start()
    logger.info("Фоновая синхронизация OWL→БД запущена, интервал %s с", interval)


def sync_owl_to_db_after_owl_write() -> None:
    """Вызвать после завершения импорта: сразу обновить зеркало, если нет других lease."""
    run_sync_with_new_session()


def release_owl_write_lease_and_resync() -> None:
    """Снять одну lease запись в OWL и запустить синхронизацию зеркала (после импорта / upload)."""
    from app.main import SessionLocal

    if SessionLocal is None:
        return
    db = SessionLocal()
    try:
        release_owl_write_lease(db)
    finally:
        db.close()
    run_sync_with_new_session()
