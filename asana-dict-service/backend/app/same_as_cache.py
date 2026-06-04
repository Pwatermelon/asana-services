"""
Кэш выведенных OWL 2 RL связей isSameAsObject.

Пересчёт только при изменении онтологии (persist). Чтение API использует asserted-граф + этот кэш,
без запуска reasoner на каждый запрос.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, FrozenSet, Optional, Set, Tuple

from rdflib import Graph, URIRef
from rdflib.namespace import RDF

logger = logging.getLogger("asana_service.same_as_cache")

REDIS_KEY = "ontology:inferred_same_as:v1"

_inferred_pairs: Optional[FrozenSet[Tuple[str, str]]] = None
_cache_ready = False


def _redis_client():
    try:
        from app.user_activity import _client

        return _client()
    except Exception:
        return None


def canonical_pair_uri(u: URIRef, v: URIRef) -> Tuple[str, str]:
    a, b = sorted([str(u), str(v)])
    return (a, b)


def collect_asserted_same_as_pairs(g: Graph, is_same_as_property) -> Set[Tuple[str, str]]:
    from app.ontology import ASANA

    pairs: Set[Tuple[str, str]] = set()
    for s, p, o in g.triples((None, is_same_as_property, None)):
        if (s, RDF.type, ASANA.Asana) in g and (o, RDF.type, ASANA.Asana) in g:
            pairs.add(canonical_pair_uri(s, o))
    return pairs


def collect_reasoned_same_as_pairs(g: Graph, is_same_as_property) -> Set[Tuple[str, str]]:
    from app.ontology import ASANA

    pairs: Set[Tuple[str, str]] = set()
    for s, p, o in g.triples((None, is_same_as_property, None)):
        if (s, RDF.type, ASANA.Asana) in g and (o, RDF.type, ASANA.Asana) in g:
            pairs.add(canonical_pair_uri(s, o))
    return pairs


def clear_same_as_inference_cache() -> None:
    global _inferred_pairs, _cache_ready
    _inferred_pairs = None
    _cache_ready = False
    client = _redis_client()
    if client:
        try:
            client.delete(REDIS_KEY)
        except Exception as exc:
            logger.debug("Redis clear inferred sameAs failed: %s", exc)


def _save_to_redis(pairs: FrozenSet[Tuple[str, str]]) -> None:
    client = _redis_client()
    if not client:
        return
    try:
        payload = json.dumps([list(p) for p in pairs], ensure_ascii=False)
        client.set(REDIS_KEY, payload)
    except Exception as exc:
        logger.warning("Redis save inferred sameAs failed: %s", exc)


def _load_from_redis() -> Optional[FrozenSet[Tuple[str, str]]]:
    client = _redis_client()
    if not client:
        return None
    try:
        raw = client.get(REDIS_KEY)
        if not raw:
            return None
        data = json.loads(raw)
        return frozenset(tuple(x) for x in data)
    except Exception as exc:
        logger.warning("Redis load inferred sameAs failed: %s", exc)
        return None


def rebuild_same_as_inference_cache(asserted: Graph) -> int:
    """
    OWL 2 RL один раз по asserted-графу; в БД пишутся только asserted-триплеты.
    В кэш (RAM + Redis) — пары связей, которые есть в closure, но нет в asserted.
    """
    global _inferred_pairs, _cache_ready
    from app.ontology import ASANA
    from app.owl_reasoning import build_reasoned_graph

    asserted_pairs = collect_asserted_same_as_pairs(asserted, ASANA.isSameAsObject)
    reasoned = build_reasoned_graph(asserted, ASANA.isSameAsObject)
    reasoned_pairs = collect_reasoned_same_as_pairs(reasoned, ASANA.isSameAsObject)
    inferred = frozenset(reasoned_pairs - asserted_pairs)
    _inferred_pairs = inferred
    _cache_ready = True
    _save_to_redis(inferred)
    logger.info(
        "sameAs inference cache rebuilt: asserted_edges=%s, inferred_edges=%s",
        len(asserted_pairs),
        len(inferred),
    )
    return len(inferred)


def ensure_same_as_inference_cache(asserted: Optional[Graph] = None) -> None:
    global _inferred_pairs, _cache_ready
    if _cache_ready and _inferred_pairs is not None:
        return
    loaded = _load_from_redis()
    if loaded is not None:
        _inferred_pairs = loaded
        _cache_ready = True
        logger.info("sameAs inference cache loaded from Redis (%s pairs)", len(loaded))
        return
    if asserted is None:
        from app.ontology import get_graph

        asserted = get_graph()
    rebuild_same_as_inference_cache(asserted)


def get_inferred_same_as_pairs() -> FrozenSet[Tuple[str, str]]:
    ensure_same_as_inference_cache()
    return _inferred_pairs or frozenset()


def is_asserted_same_as_pair(g: Graph, u: URIRef, v: URIRef) -> bool:
    from app.ontology import ASANA

    if u == v:
        return False
    prop = ASANA.isSameAsObject
    return (u, prop, v) in g or (v, prop, u) in g


def is_inferred_same_as_link(g: Graph, u: URIRef, v: URIRef) -> bool:
    """Связь в замыкании есть, прямого asserted-ребра между u и v нет."""
    if is_asserted_same_as_pair(g, u, v):
        return False
    return canonical_pair_uri(u, v) in get_inferred_same_as_pairs()


def effective_same_as_neighbors(g: Graph, asana_uri: URIRef) -> set:
    """Соседи по asserted + выведенным (из кэша) рёбрам."""
    from app.ontology import ASANA, _same_as_neighbors

    neighbors = _same_as_neighbors(g, asana_uri)
    key = str(asana_uri)
    for a, b in get_inferred_same_as_pairs():
        other = b if a == key else (a if b == key else None)
        if other:
            o = URIRef(other)
            if (o, RDF.type, ASANA.Asana) in g:
                neighbors.add(o)
    return neighbors
