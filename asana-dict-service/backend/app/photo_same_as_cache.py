"""
Кэш выведенных связей isSameAsObject между AsanaPhoto.

Транзитивное замыкание строится по всем asserted sameAs.
notSameAsObject отключает sameAs только для конкретной пары (прямой запрос и вывод
по транзитивности для этой пары), но не запрещает добавлять sameAs с другими фото.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

from rdflib import Graph, URIRef
from rdflib.namespace import RDF

logger = logging.getLogger("asana_service.photo_same_as_cache")

REDIS_KEY = "ontology:inferred_photo_same_as:v3"
REDIS_META_KEY = "ontology:inferred_photo_same_as:meta:v3"
MIGRATION_REDIS_KEY = "ontology:migration:photo_links_v1"

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


def collect_asserted_photo_same_as_pairs(g: Graph, is_same_as_property) -> Set[Tuple[str, str]]:
    from app.ontology import ASANA

    pairs: Set[Tuple[str, str]] = set()
    for s, p, o in g.triples((None, is_same_as_property, None)):
        if (s, RDF.type, ASANA.AsanaPhoto) in g and (o, RDF.type, ASANA.AsanaPhoto) in g:
            pairs.add(canonical_pair_uri(s, o))
    return pairs


def collect_not_same_as_photo_pairs(g: Graph) -> Set[Tuple[str, str]]:
    from app.ontology import ASANA

    pairs: Set[Tuple[str, str]] = set()
    for s, p, o in g.triples((None, ASANA.notSameAsObject, None)):
        if (s, RDF.type, ASANA.AsanaPhoto) in g and (o, RDF.type, ASANA.AsanaPhoto) in g:
            pairs.add(canonical_pair_uri(s, o))
    return pairs


def _all_photo_uris(g: Graph) -> List[URIRef]:
    from app.ontology import ASANA

    return sorted({s for s in g.subjects(RDF.type, ASANA.AsanaPhoto)}, key=str)


class _PhotoSameAsUnionFind:
    """Union-find по фото для компонент связности asserted sameAs."""

    def __init__(self, nodes: List[URIRef]) -> None:
        self.parent: Dict[str, str] = {str(n): str(n) for n in nodes}
        self.members: Dict[str, Set[str]] = {str(n): {str(n)} for n in nodes}

    def find(self, x: URIRef) -> str:
        key = str(x)
        root = self.parent[key]
        if root != key:
            self.parent[key] = self.find(URIRef(root))
        return self.parent[key]

    def union(self, a: URIRef, b: URIRef) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if len(self.members[ra]) < len(self.members[rb]):
            ra, rb = rb, ra
        self.members[ra] |= self.members[rb]
        for m in self.members[rb]:
            self.parent[m] = ra
        del self.members[rb]

    def component_pairs(self) -> Set[Tuple[str, str]]:
        pairs: Set[Tuple[str, str]] = set()
        for members in self.members.values():
            ml = sorted(members)
            for i in range(len(ml)):
                for j in range(i + 1, len(ml)):
                    pairs.add((ml[i], ml[j]))
        return pairs


def build_photo_same_as_union_find(g: Graph) -> _PhotoSameAsUnionFind:
    """Компоненты связности по asserted sameAs (без разрезания по notSameAs)."""
    from app.ontology import ASANA

    photos = _all_photo_uris(g)
    uf = _PhotoSameAsUnionFind(photos)
    asserted = collect_asserted_photo_same_as_pairs(g, ASANA.isSameAsObject)
    for a, b in sorted(asserted):
        uf.union(URIRef(a), URIRef(b))
    return uf


def compute_effective_same_as_pairs(g: Graph) -> Tuple[Set[Tuple[str, str]], Set[Tuple[str, str]]]:
    """
    (asserted_pairs, inferred_pairs).
    inferred — транзитивное замыкание sameAs минус asserted и минус пары с notSameAs.
    """
    from app.ontology import ASANA

    asserted = collect_asserted_photo_same_as_pairs(g, ASANA.isSameAsObject)
    not_same = collect_not_same_as_photo_pairs(g)
    closure = build_photo_same_as_union_find(g).component_pairs()
    effective = {p for p in closure if p not in not_same}
    inferred = effective - asserted
    return asserted, inferred


def clear_photo_same_as_inference_cache() -> None:
    global _inferred_pairs, _cache_ready
    _inferred_pairs = None
    _cache_ready = False
    client = _redis_client()
    if client:
        try:
            client.delete(REDIS_KEY)
            client.delete(REDIS_META_KEY)
        except Exception as exc:
            logger.debug("Redis clear inferred photo sameAs failed: %s", exc)


def _cache_fingerprint(asserted: Graph) -> Dict[str, int]:
    from app.ontology import ASANA

    return {
        "asserted_same_as": len(collect_asserted_photo_same_as_pairs(asserted, ASANA.isSameAsObject)),
        "not_same_as": len(collect_not_same_as_photo_pairs(asserted)),
    }


def _save_to_redis(pairs: FrozenSet[Tuple[str, str]], fingerprint: Dict[str, int]) -> None:
    client = _redis_client()
    if not client:
        return
    try:
        payload = json.dumps([list(p) for p in pairs], ensure_ascii=False)
        client.set(REDIS_KEY, payload)
        client.set(REDIS_META_KEY, json.dumps(fingerprint, ensure_ascii=False))
    except Exception as exc:
        logger.warning("Redis save inferred photo sameAs failed: %s", exc)


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
        logger.warning("Redis load inferred photo sameAs failed: %s", exc)
        return None


def _redis_cache_matches_asserted(asserted: Graph) -> bool:
    client = _redis_client()
    if not client:
        return False
    try:
        raw = client.get(REDIS_META_KEY)
        if not raw:
            return False
        meta = json.loads(raw)
        return meta == _cache_fingerprint(asserted)
    except Exception:
        return False


def rebuild_photo_same_as_inference_cache(asserted: Graph) -> int:
    global _inferred_pairs, _cache_ready

    asserted_pairs, inferred_set = compute_effective_same_as_pairs(asserted)
    inferred = frozenset(inferred_set)
    _inferred_pairs = inferred
    _cache_ready = True
    _save_to_redis(inferred, _cache_fingerprint(asserted))
    logger.info(
        "photo sameAs cache rebuilt: asserted=%s inferred=%s (pairwise notSameAs filter)",
        len(asserted_pairs),
        len(inferred),
    )
    return len(inferred)


def ensure_photo_same_as_inference_cache(asserted: Optional[Graph] = None) -> None:
    global _inferred_pairs, _cache_ready
    if _cache_ready and _inferred_pairs is not None:
        return
    if asserted is None:
        from app.ontology import get_graph

        asserted = get_graph()
    loaded = _load_from_redis()
    if loaded is not None and _redis_cache_matches_asserted(asserted):
        _inferred_pairs = loaded
        _cache_ready = True
        return
    rebuild_photo_same_as_inference_cache(asserted)


def get_inferred_photo_same_as_pairs() -> FrozenSet[Tuple[str, str]]:
    ensure_photo_same_as_inference_cache()
    return _inferred_pairs or frozenset()


def is_asserted_photo_same_as_pair(g: Graph, u: URIRef, v: URIRef) -> bool:
    from app.ontology import ASANA

    if u == v:
        return False
    prop = ASANA.isSameAsObject
    return (u, prop, v) in g or (v, prop, u) in g


def is_inferred_photo_same_as_link(g: Graph, u: URIRef, v: URIRef) -> bool:
    if is_asserted_photo_same_as_pair(g, u, v):
        return False
    return canonical_pair_uri(u, v) in get_inferred_photo_same_as_pairs()


def effective_photo_same_as_neighbors(g: Graph, photo_uri: URIRef) -> set:
    from app.ontology import ASANA

    not_same = collect_not_same_as_photo_pairs(g)
    key = str(photo_uri)

    def blocked(u: URIRef, v: URIRef) -> bool:
        pair = canonical_pair_uri(u, v)
        return pair in not_same

    neighbors: set = set()
    for o in g.objects(photo_uri, ASANA.isSameAsObject):
        if not blocked(photo_uri, o):
            neighbors.add(o)
    for s in g.subjects(ASANA.isSameAsObject, photo_uri):
        if not blocked(photo_uri, s):
            neighbors.add(s)
    for a, b in get_inferred_photo_same_as_pairs():
        other = b if a == key else (a if b == key else None)
        if other:
            o = URIRef(other)
            if (o, RDF.type, ASANA.AsanaPhoto) in g and not blocked(photo_uri, o):
                neighbors.add(o)
    return neighbors


def photo_links_migration_done() -> bool:
    client = _redis_client()
    if not client:
        return False
    try:
        return client.get(MIGRATION_REDIS_KEY) == "1"
    except Exception:
        return False


def mark_photo_links_migration_done() -> None:
    client = _redis_client()
    if client:
        try:
            client.set(MIGRATION_REDIS_KEY, "1")
        except Exception as exc:
            logger.warning("mark migration done failed: %s", exc)
