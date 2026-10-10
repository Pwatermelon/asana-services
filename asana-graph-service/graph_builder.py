"""
Граф асан из зеркала catalog_mirror_items (БД каталога).

Не зависит от кода asana-dict-service: читает JSON payload асан
(same_as_photo_ids на фото) и опционально inferred-пары из Redis.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import create_engine, text

from config import settings

logger = logging.getLogger("asana_graph_service")


def _short_id(uri: str) -> str:
    if "#" in uri:
        return uri.rsplit("#", 1)[-1]
    return uri.rsplit("/", 1)[-1]


def _load_asanas_from_mirror() -> List[Dict[str, Any]]:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    schema = settings.DICT_SCHEMA
    sql = text(
        f'SELECT payload FROM "{schema}".catalog_mirror_items WHERE entity_type = :etype'
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, {"etype": "Asana"}).fetchall()
    out: List[Dict[str, Any]] = []
    for (payload,) in rows:
        if isinstance(payload, str):
            payload = json.loads(payload)
        if isinstance(payload, dict):
            out.append(payload)
    return out


def _inferred_photo_pairs() -> Set[Tuple[str, str]]:
    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        raw = client.get(settings.INFERRED_REDIS_KEY)
        if not raw:
            return set()
        data = json.loads(raw)
        pairs = set()
        # формат: список [a,b] или {"pairs": [...]}
        items = data if isinstance(data, list) else data.get("pairs") or []
        for item in items:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                a, b = sorted([str(item[0]), str(item[1])])
                pairs.add((a, b))
        return pairs
    except Exception as exc:
        logger.debug("inferred redis unavailable: %s", exc)
        return set()


def build_asana_same_as_graph(
    *,
    include_inferred: bool = False,
    only_linked: bool = True,
) -> Dict[str, Any]:
    asanas = _load_asanas_from_mirror()

    photo_owner: Dict[str, str] = {}
    asana_meta: Dict[str, Dict[str, str]] = {}
    asserted_photo_pairs: Set[Tuple[str, str]] = set()

    for a in asanas:
        aid = str(a.get("id") or "")
        if not aid:
            continue
        name = a.get("name") or {}
        name_ru = str(name.get("name_ru") or "")
        name_sa = str(name.get("name_sanskrit") or "")
        asana_meta[aid] = {
            "label": name_ru or name_sa or _short_id(aid),
            "name_ru": name_ru,
            "name_sanskrit": name_sa,
        }
        for ph in a.get("photos") or []:
            pid = str(ph.get("id") or "")
            if not pid:
                continue
            photo_owner[pid] = aid
            for tid in ph.get("same_as_photo_ids") or []:
                t = str(tid)
                if not t or t == pid:
                    continue
                pair = tuple(sorted([pid, t]))
                asserted_photo_pairs.add(pair)  # type: ignore[arg-type]

    edge_kinds: Dict[Tuple[str, str], Set[str]] = {}
    linked: Set[str] = set()

    def add_asana_edge(a: str, b: str, kind: str) -> None:
        if not a or not b or a == b:
            return
        key = tuple(sorted([a, b]))
        edge_kinds.setdefault(key, set()).add(kind)  # type: ignore[arg-type]
        linked.add(a)
        linked.add(b)

    for pa, pb in asserted_photo_pairs:
        add_asana_edge(photo_owner.get(pa, ""), photo_owner.get(pb, ""), "asserted")

    photo_pair_count = len(asserted_photo_pairs)
    if include_inferred:
        inferred = _inferred_photo_pairs()
        photo_pair_count += len(inferred)
        for pa, pb in inferred:
            add_asana_edge(photo_owner.get(pa, ""), photo_owner.get(pb, ""), "inferred")

    node_ids = sorted(linked if only_linked else asana_meta.keys())
    nodes = [
        {
            "id": aid,
            "short_id": _short_id(aid),
            **asana_meta.get(
                aid,
                {"label": _short_id(aid), "name_ru": "", "name_sanskrit": ""},
            ),
        }
        for aid in node_ids
        if aid in asana_meta or only_linked
    ]
    # only_linked уже отфильтровал; для only_linked=False включаем все
    if not only_linked:
        nodes = [
            {
                "id": aid,
                "short_id": _short_id(aid),
                **meta,
            }
            for aid, meta in sorted(asana_meta.items())
        ]

    edges = []
    for (a, b), kinds in sorted(edge_kinds.items()):
        edges.append(
            {
                "source": a,
                "target": b,
                "relation": "isSameAsObject",
                "kind": "asserted" if "asserted" in kinds else "inferred",
            }
        )

    return {
        "relation": "isSameAsObject",
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "photo_pairs": photo_pair_count,
            "include_inferred": include_inferred,
            "only_linked": only_linked,
            "source": "catalog_mirror_items",
        },
    }
