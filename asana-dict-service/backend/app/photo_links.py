"""
Связи isSameAsObject / notSameAsObject между AsanaPhoto (не между Asana).

- isSameAsObject: транзитивность по asserted-связям; inferred только в кэше.
- notSameAsObject: запрет только для конкретной пары — эти два фото не считаются
  sameAs (ни напрямую, ни по транзитивности), но не мешают указывать sameAs с другими фото.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from rdflib import Graph, URIRef
from rdflib.namespace import RDF

logger = logging.getLogger("asana_service.photo_links")

MIGRATION_FLAG_KEY = "photo_level_links_v1"


def make_photo_uri(photo_id: str) -> URIRef:
    pid = str(photo_id or "").strip()
    if not pid.startswith("http://"):
        if not pid.startswith("photo_"):
            pid = f"photo_{pid}"
        pid = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{pid}"
    return URIRef(pid)


def _is_photo(g: Graph, uri: URIRef) -> bool:
    from app.ontology import ASANA

    return (uri, RDF.type, ASANA.AsanaPhoto) in g


def _photo_same_as_neighbors(g: Graph, photo_uri: URIRef) -> Set[URIRef]:
    from app.ontology import ASANA

    neighbors: Set[URIRef] = set()
    for o in g.objects(photo_uri, ASANA.isSameAsObject):
        neighbors.add(o)
    for s in g.subjects(ASANA.isSameAsObject, photo_uri):
        neighbors.add(s)
    return neighbors


def _photo_not_same_as_neighbors(g: Graph, photo_uri: URIRef) -> Set[URIRef]:
    from app.ontology import ASANA

    neighbors: Set[URIRef] = set()
    for o in g.objects(photo_uri, ASANA.notSameAsObject):
        neighbors.add(o)
    for s in g.subjects(ASANA.notSameAsObject, photo_uri):
        neighbors.add(s)
    return neighbors


def are_photos_effectively_same_as(g: Graph, u: URIRef, v: URIRef) -> bool:
    """sameAs (asserted/inferred) с приоритетом notSameAs для пары."""
    if u == v:
        return True
    if is_asserted_photo_not_same_as_pair(g, u, v):
        return False
    if is_asserted_photo_same_as_pair(g, u, v):
        return True
    if is_inferred_photo_same_as_link(g, u, v):
        return True
    return False


def photo_pair_has_not_same_as(g: Graph, u: URIRef, v: URIRef) -> bool:
    return is_asserted_photo_not_same_as_pair(g, u, v)


def validate_add_same_as_photo(g: Graph, u: URIRef, v: URIRef) -> Optional[str]:
    """None — можно добавить; иначе текст ошибки."""
    if u == v:
        return "Нельзя связать фото с самим собой"
    if not _is_photo(g, u) or not _is_photo(g, v):
        return "Фото не найдено"
    if photo_pair_has_not_same_as(g, u, v):
        return "Между этими двумя фото уже указано «не соответствует»"
    return None


def validate_add_not_same_as_photo(g: Graph, u: URIRef, v: URIRef) -> Optional[str]:
    """None — можно добавить; иначе текст ошибки."""
    if u == v:
        return "Нельзя указать «не соответствует» для одного и того же фото"
    if not _is_photo(g, u) or not _is_photo(g, v):
        return "Фото не найдено"
    if is_asserted_photo_same_as_pair(g, u, v):
        return "Между фото уже есть явная связь isSameAs"
    return None


def photo_same_as_component_effective(g: Graph, start_uri: URIRef) -> Set[URIRef]:
    from app.photo_same_as_cache import _all_photo_uris

    if not _is_photo(g, start_uri):
        return set()
    out: Set[URIRef] = {start_uri}
    for uri in _all_photo_uris(g):
        if uri != start_uri and are_photos_effectively_same_as(g, start_uri, uri):
            out.add(uri)
    return out


def is_inferred_photo_same_as_link(g: Graph, u: URIRef, v: URIRef) -> bool:
    from app.photo_same_as_cache import is_inferred_photo_same_as_link as _inf

    return _inf(g, u, v)


def is_asserted_photo_same_as_pair(g: Graph, u: URIRef, v: URIRef) -> bool:
    from app.photo_same_as_cache import is_asserted_photo_same_as_pair as _asp

    return _asp(g, u, v)


def is_asserted_photo_not_same_as_pair(g: Graph, u: URIRef, v: URIRef) -> bool:
    from app.ontology import ASANA

    if u == v:
        return False
    prop = ASANA.notSameAsObject
    return (u, prop, v) in g or (v, prop, u) in g


def photo_pair_is_decided(g: Graph, photo_a: URIRef, photo_b: URIRef) -> bool:
    """Между фото уже есть явный notSameAs или sameAs (asserted или inferred)."""
    if is_asserted_photo_not_same_as_pair(g, photo_a, photo_b):
        return True
    if is_asserted_photo_same_as_pair(g, photo_a, photo_b):
        return True
    if is_inferred_photo_same_as_link(g, photo_a, photo_b):
        return True
    return False


def owner_asana_uri(g: Graph, photo_uri: URIRef) -> Optional[URIRef]:
    from app.ontology import ASANA

    for s in g.subjects(ASANA.hasPhoto, photo_uri):
        if (s, RDF.type, ASANA.Asana) in g:
            return s
    return None


def serialize_photo_link_row(g: Graph, photo_uri: URIRef, subject_uri: URIRef) -> Optional[Dict[str, Any]]:
    """Одна связанная фотография для API (с контекстом асаны и источника)."""
    from app.ontology import ASANA, get_s3_url

    if not _is_photo(g, photo_uri):
        return None
    owner = owner_asana_uri(g, photo_uri)
    if not owner:
        return None
    name_obj = g.value(owner, ASANA.hasName)
    source_obj = g.value(photo_uri, ASANA.hasSource)
    s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
    base64_photo = g.value(photo_uri, ASANA.base64Photo)
    image = get_s3_url(str(s3_path)) if s3_path else (str(base64_photo) if base64_photo else None)
    source_data = {}
    if source_obj:
        source_data = {
            "id": str(source_obj),
            "title": str(g.value(source_obj, ASANA.sourseTitle) or ""),
            "author": str(g.value(source_obj, ASANA.sourceAuthor) or ""),
            "year": int(g.value(source_obj, ASANA.sourceYear))
            if g.value(source_obj, ASANA.sourceYear)
            else None,
        }
    return {
        "photo_id": str(photo_uri),
        "asana_id": str(owner),
        "image": image,
        "source": source_data,
        "name": {
            "name_ru": str(g.value(name_obj, ASANA.nameInRussian) or "") if name_obj else "",
            "name_sanskrit": str(g.value(name_obj, ASANA.nameInSanskrit) or "") if name_obj else "",
        },
        "same_as_link_inferred": is_inferred_photo_same_as_link(g, subject_uri, photo_uri),
        "not_same_as_link": is_asserted_photo_not_same_as_pair(g, subject_uri, photo_uri),
    }


def get_not_same_as_photos(photo_id: str) -> List[Dict[str, Any]]:
    from app.ontology import get_graph

    g = get_graph()
    subject = make_photo_uri(photo_id)
    if not _is_photo(g, subject):
        return []
    out: List[Dict[str, Any]] = []
    for uri in _photo_not_same_as_neighbors(g, subject):
        if uri == subject:
            continue
        row = serialize_photo_link_row(g, uri, subject)
        if row:
            row["not_same_as_link"] = True
            row["same_as_link_inferred"] = False
            out.append(row)
    return out


def get_similar_photos(photo_id: str) -> List[Dict[str, Any]]:
    from app.ontology import get_graph

    g = get_graph()
    subject = make_photo_uri(photo_id)
    if not _is_photo(g, subject):
        return []
    component = photo_same_as_component_effective(g, subject)
    out: List[Dict[str, Any]] = []
    for uri in component:
        if uri == subject:
            continue
        row = serialize_photo_link_row(g, uri, subject)
        if row:
            out.append(row)
    return out


def get_similar_asanas_via_photos(asana_id: str) -> List[Dict[str, Any]]:
    """Агрегация для совместимости: асаны, связанные через sameAs фото."""
    from app.ontology import ASANA, get_graph, load_asana_by_id, make_asana_uri

    g = get_graph()
    asana_uri = make_asana_uri(asana_id)
    if (asana_uri, RDF.type, ASANA.Asana) not in g:
        return []
    linked_asana_uris: Set[URIRef] = set()
    inferred_flags: Dict[str, bool] = {}
    for photo in g.objects(asana_uri, ASANA.hasPhoto):
        for linked_photo in photo_same_as_component_effective(g, photo) - {photo}:
            owner = owner_asana_uri(g, linked_photo)
            if owner and owner != asana_uri:
                linked_asana_uris.add(owner)
                key = str(owner)
                inf = is_inferred_photo_same_as_link(g, photo, linked_photo)
                inferred_flags[key] = inferred_flags.get(key, False) or inf
    result = []
    for uri in linked_asana_uris:
        rec = load_asana_by_id(str(uri))
        if rec:
            rec = dict(rec)
            rec["same_as_link_inferred"] = inferred_flags.get(str(uri), False)
            result.append(rec)
    return result


def add_same_as_photo(photo_id: str, target_photo_id: str) -> tuple[bool, Optional[str]]:
    from app.ontology import ASANA, _persist_ontology_graph, get_graph

    g = get_graph()
    u = make_photo_uri(photo_id)
    v = make_photo_uri(target_photo_id)
    err = validate_add_same_as_photo(g, u, v)
    if err:
        logger.warning("Cannot add sameAs %s–%s: %s", u, v, err)
        return False, err
    if (u, ASANA.isSameAsObject, v) in g or (v, ASANA.isSameAsObject, u) in g:
        return True, None
    g.add((u, ASANA.isSameAsObject, v))
    _persist_ontology_graph(g)
    return True, None


def remove_same_as_photo(photo_id: str, target_photo_id: str) -> bool:
    from app.ontology import ASANA, _persist_ontology_graph, get_graph

    g = get_graph()
    u = make_photo_uri(photo_id)
    v = make_photo_uri(target_photo_id)
    g.remove((u, ASANA.isSameAsObject, v))
    g.remove((v, ASANA.isSameAsObject, u))
    _persist_ontology_graph(g)
    return True


def add_not_same_as_photo(photo_id: str, target_photo_id: str) -> tuple[bool, Optional[str]]:
    from app.ontology import ASANA, _persist_ontology_graph, get_graph

    g = get_graph()
    u = make_photo_uri(photo_id)
    v = make_photo_uri(target_photo_id)
    if photo_pair_has_not_same_as(g, u, v):
        return True, None
    err = validate_add_not_same_as_photo(g, u, v)
    if err:
        logger.warning("Cannot add notSameAs %s–%s: %s", u, v, err)
        return False, err
    g.add((u, ASANA.notSameAsObject, v))
    g.add((v, ASANA.notSameAsObject, u))
    _persist_ontology_graph(g)
    return True, None


def remove_not_same_as_photo(photo_id: str, target_photo_id: str) -> bool:
    from app.ontology import ASANA, _persist_ontology_graph, get_graph

    g = get_graph()
    u = make_photo_uri(photo_id)
    v = make_photo_uri(target_photo_id)
    g.remove((u, ASANA.notSameAsObject, v))
    g.remove((v, ASANA.notSameAsObject, u))
    _persist_ontology_graph(g)
    return True


def asserted_same_as_photo_ids(g: Graph, photo_uri: URIRef) -> List[str]:
    return sorted(
        str(n) for n in _photo_same_as_neighbors(g, photo_uri) if _is_photo(g, n)
    )


def asserted_not_same_as_photo_ids(g: Graph, photo_uri: URIRef) -> List[str]:
    return sorted(
        str(n) for n in _photo_not_same_as_neighbors(g, photo_uri) if _is_photo(g, n)
    )


def _source_caption_from_graph(g: Graph, source_obj: URIRef) -> str:
    from app.ontology import ASANA

    if not source_obj:
        return "Источник не указан"
    author = str(g.value(source_obj, ASANA.sourceAuthor) or "").strip()
    title = str(g.value(source_obj, ASANA.sourseTitle) or "").strip()
    year_val = g.value(source_obj, ASANA.sourceYear)
    year = str(int(year_val)) if year_val is not None else ""
    parts = [p for p in (author, title) if p]
    caption = " — ".join(parts) if parts else title or author or ""
    if year:
        caption = f"{caption} ({year})" if caption else f"({year})"
    return caption or "Источник не указан"


def load_photos_for_match_index() -> List[Dict[str, Any]]:
    """Плоский индекс всех фото для модалки «Указать соответствие» (без полного каталога)."""
    from app.ontology import ASANA, get_graph, get_s3_url

    g = get_graph()
    rows: List[Dict[str, Any]] = []
    for asana in g.subjects(RDF.type, ASANA.Asana):
        name_obj = g.value(asana, ASANA.hasName)
        name_ru = str(g.value(name_obj, ASANA.nameInRussian) or "") if name_obj else ""
        name_sanskrit = (
            str(g.value(name_obj, ASANA.nameInSanskrit) or "")
            if name_obj and g.value(name_obj, ASANA.nameInSanskrit)
            else ""
        )
        for idx, photo in enumerate(g.objects(asana, ASANA.hasPhoto)):
            if not _is_photo(g, photo):
                continue
            s3_path = g.value(photo, ASANA.s3PhotoPath)
            base64_photo = g.value(photo, ASANA.base64Photo)
            image = get_s3_url(str(s3_path)) if s3_path else (str(base64_photo) if base64_photo else None)
            if not image:
                continue
            source_obj = g.value(photo, ASANA.hasSource)
            photo_data: Dict[str, Any] = {
                "id": str(photo),
                "image": image,
                "source": str(source_obj) if source_obj else None,
                "same_as_photo_ids": asserted_same_as_photo_ids(g, photo),
                "not_same_as_photo_ids": asserted_not_same_as_photo_ids(g, photo),
            }
            rows.append(
                {
                    "photo_id": str(photo),
                    "photo": photo_data,
                    "photoIndexInOwner": idx,
                    "ownerId": str(asana),
                    "nameRu": name_ru,
                    "nameSanskrit": name_sanskrit,
                    "sourceCaption": _source_caption_from_graph(g, source_obj) if source_obj else "Источник не указан",
                    "linkId": str(source_obj) if source_obj else None,
                }
            )
    rows.sort(
        key=lambda r: (
            (r.get("nameRu") or "").lower(),
            (r.get("sourceCaption") or "").lower(),
        )
    )
    return rows


def migrate_drop_asana_level_same_as_links(g: Graph) -> Dict[str, int]:
    """
    Удаляет все isSameAsObject между Asana (старая модель).
    Связи между фото не трогает.
    """
    from app.ontology import ASANA

    removed = 0
    for s, p, o in list(g.triples((None, ASANA.isSameAsObject, None))):
        s_is_asana = (s, RDF.type, ASANA.Asana) in g
        o_is_asana = (o, RDF.type, ASANA.Asana) in g
        if s_is_asana or o_is_asana:
            g.remove((s, p, o))
            removed += 1
    return {"removed_asana_same_as_triples": removed}


def run_photo_links_migration() -> Dict[str, Any]:
    """Стартовая миграция: снять asana-level sameAs, включить кэш photo-level."""
    from app.catalog_sync import acquire_owl_write_lease, release_owl_write_lease
    from app.main import SessionLocal
    from app.ontology import ASANA, _persist_ontology_graph, get_graph, invalidate_ontology_cache
    from app.owl_reasoning import inject_is_same_as_owl_axioms, inject_not_same_as_owl_axioms
    from app.photo_same_as_cache import mark_photo_links_migration_done, photo_links_migration_done

    if photo_links_migration_done():
        return {"skipped": True}

    db = SessionLocal()
    try:
        acquire_owl_write_lease(db)
    finally:
        db.close()

    stats: Dict[str, Any] = {"skipped": False}
    try:
        g = get_graph()
        stats.update(migrate_drop_asana_level_same_as_links(g))
        inject_is_same_as_owl_axioms(g, ASANA.isSameAsObject)
        inject_not_same_as_owl_axioms(g, ASANA.notSameAsObject)
        _persist_ontology_graph(g)
        invalidate_ontology_cache()
        mark_photo_links_migration_done()
        logger.info("Photo-level links migration completed: %s", stats)
        return stats
    finally:
        db = SessionLocal()
        try:
            release_owl_write_lease(db)
        finally:
            db.close()
