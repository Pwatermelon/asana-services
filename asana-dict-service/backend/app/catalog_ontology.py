"""
DB-first: зеркало каталога в PostgreSQL — источник истины; OWL — экспортируемый файл.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from rdflib import Graph, Literal, RDF, URIRef

from app import config

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger("asana_service.catalog_ontology")


def _utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def snapshot_graph_to_mirror(session: "Session", g: Graph) -> None:
    """Полная перезапись catalog_mirror_items из графа (одна транзакция с вызывающим кодом)."""
    from app.models import CatalogMirrorItem
    from app.ontology import load_asana_names_from_graph, load_asanas_from_graph, load_sources_from_graph

    names = load_asana_names_from_graph(g)
    sources = load_sources_from_graph(g)
    asanas = load_asanas_from_graph(g)

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


def build_graph_from_mirror(session: "Session") -> Graph:
    """Собирает rdflib Graph из строк зеркала (обратная сериализация payload → триплеты)."""
    from app.models import CatalogMirrorItem
    from app.ontology import ASANA, ASANA_DEFINITION

    g = Graph()
    g.bind("asana", ASANA)

    rows = session.query(CatalogMirrorItem).all()
    by_type = {"AsanaName": [], "AsanaSource": [], "Asana": []}
    for row in rows:
        if row.entity_type in by_type:
            by_type[row.entity_type].append(row.payload)

    for p in by_type["AsanaName"]:
        uri = URIRef(p["id"])
        g.add((uri, RDF.type, ASANA.AsanaName))
        g.add((uri, ASANA.nameInRussian, Literal(p.get("name_ru") or "")))
        if p.get("name_sanskrit"):
            g.add((uri, ASANA.nameInSanskrit, Literal(str(p["name_sanskrit"]))))
        if p.get("transliteration"):
            g.add((uri, ASANA.nameInTranslit, Literal(str(p["transliteration"]))))
        if p.get("definition"):
            g.add((uri, ASANA_DEFINITION, Literal(str(p["definition"]))))

    for p in by_type["AsanaSource"]:
        uri = URIRef(p["id"])
        g.add((uri, RDF.type, ASANA.AsanaSource))
        g.add((uri, ASANA.sourseTitle, Literal(p.get("title") or "")))
        g.add((uri, ASANA.sourceAuthor, Literal(p.get("author") or "")))
        y = p.get("year")
        g.add((uri, ASANA.sourceYear, Literal(int(y) if y is not None else 0)))
        if p.get("publisher"):
            g.add((uri, ASANA.sourcePublisher, Literal(str(p["publisher"]))))
        pages = p.get("pages")
        if pages is not None:
            g.add((uri, ASANA.sourcePages, Literal(int(pages))))
        if p.get("annotation"):
            g.add((uri, ASANA.sourceAnnotation, Literal(str(p["annotation"]))))

    for p in by_type["Asana"]:
        asana_uri = URIRef(p["id"])
        g.add((asana_uri, RDF.type, ASANA.Asana))
        nm = p.get("name") or {}
        name_id = nm.get("id")
        if name_id:
            g.add((asana_uri, ASANA.hasName, URIRef(name_id)))
        for target in p.get("same_as_ids") or []:
            g.add((asana_uri, ASANA.isSameAsObject, URIRef(target)))

        for ph in p.get("photos") or []:
            pid = ph.get("id")
            if not pid:
                continue
            photo_uri = URIRef(pid)
            g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
            s3p = ph.get("s3_path")
            if s3p:
                g.add((photo_uri, ASANA.s3PhotoPath, Literal(str(s3p))))
            elif ph.get("image") and str(ph["image"]).startswith("data:"):
                g.add((photo_uri, ASANA.base64Photo, Literal(str(ph["image"]))))
            if ph.get("photo_hash"):
                g.add((photo_uri, ASANA.photoHash, Literal(str(ph["photo_hash"]))))
            src = ph.get("source")
            if src:
                g.add((photo_uri, ASANA.hasSource, URIRef(src)))
            g.add((asana_uri, ASANA.hasPhoto, photo_uri))

    return g


def persist_ontology_graph(g: Graph) -> None:
    """
    Сохраняет граф: зеркало в БД + файл OWL + хеш.
    Берёт lease записи (как импорт), чтобы фоновый OWL→БД не пересекался.
    """
    from app.catalog_sync import (
        SYNC_STATE_ID,
        ensure_catalog_sync_state_row,
        release_owl_write_lease,
        acquire_owl_write_lease,
    )
    from app.main import SessionLocal
    from app.models import CatalogSyncState

    db = SessionLocal()
    try:
        acquire_owl_write_lease(db)
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            snapshot_graph_to_mirror(db, g)
            os.makedirs(os.path.dirname(config.OWL_FILE_PATH) or ".", exist_ok=True)
            g.serialize(destination=config.OWL_FILE_PATH, format="xml")
            sha = _file_sha256(config.OWL_FILE_PATH)
            ensure_catalog_sync_state_row(db)
            row = db.query(CatalogSyncState).filter(CatalogSyncState.id == SYNC_STATE_ID).one()
            row.last_owl_sha256 = sha
            row.last_owl_to_db_at = _utc_iso()
            db.commit()
            logger.info("Сохранена онтология (DB-first): зеркало + файл OWL, sha256=%s...", sha[:12] if sha else "")
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    finally:
        db = SessionLocal()
        try:
            release_owl_write_lease(db)
        finally:
            db.close()


def _file_sha256(path: str) -> str | None:
    if not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
