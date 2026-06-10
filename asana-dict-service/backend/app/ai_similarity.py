"""
Интеграция с asana-network-service: пакетный поиск похожих фото между разными
асанами. Найденные кандидаты складываются в очередь модерации
(таблица ai_similarity_proposals), а эксперт/админ через UI подтверждает
или отклоняет каждую связь isSameAsObject.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from rdflib.namespace import RDF
from sqlalchemy.orm import Session

from app.models import AISimilarityProposal
from app.ontology import load_asanas

logger = logging.getLogger("asana_service.ai_similarity")

NETWORK_SERVICE_URL = os.getenv(
    "NETWORK_SERVICE_URL",
    os.getenv("HOST_NETWORK_SERVER", "http://server-network:8001"),
).rstrip("/")

NETWORK_SERVICE_TIMEOUT = float(os.getenv("NETWORK_SERVICE_TIMEOUT", "300"))
NETWORK_SERVICE_BATCH_SIZE = int(os.getenv("NETWORK_SERVICE_BATCH_SIZE", "200"))

# Внутри docker-сети «http://localhost/images/...» (как генерирует MINIO_URL_PREFIX
# для фронта/мобильного) не доступен из контейнера asana-network-service — там
# localhost это сам контейнер. Поэтому при отправке списка фото нейросети
# подменяем URL на внутренний адрес MinIO. У bucket «images» уже выставлен
# anonymous policy (см. minio-init в docker-compose), скачивать можно без креденшалов.
_HOST_MINIO = os.getenv("HOST_MINIO", "minio")
_PORT_MINIO = os.getenv("PORT_MINIO", "9000")
MINIO_INTERNAL_URL = os.getenv(
    "MINIO_INTERNAL_URL", f"http://{_HOST_MINIO}:{_PORT_MINIO}"
).rstrip("/")
_PUBLIC_MINIO_PREFIX = (
    os.getenv("MINIO_URL_PREFIX", "http://localhost/images").rstrip("/")
)


def _now() -> str:
    return datetime.utcnow().isoformat()


def _make_pair_key(asana_a: str, asana_b: str, reason: str) -> str:
    a, b = sorted([asana_a or "", asana_b or ""])
    raw = f"{a}|{b}|{reason}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _resolve_internal_image_url(photo: Dict[str, Any]) -> Optional[str]:
    """
    Возвращает URL, по которому контейнер `server-network` сможет скачать фото.
    Приоритет:
      1) `s3_path` (формат `<bucket>/<key>`, как сохраняется в OWL) →
         `http://minio:9000/<bucket>/<key>`;
      2) внешний URL вида `http://localhost/images/...` → переписываем префикс
         на внутренний MinIO;
      3) внешний URL как есть (на свой страх и риск).
    """
    s3_path = photo.get("s3_path")
    if s3_path and isinstance(s3_path, str):
        key = s3_path.lstrip("/")
        return f"{MINIO_INTERNAL_URL}/{key}"

    url = photo.get("image")
    if not url or not isinstance(url, str):
        return None
    if url.startswith("data:") or url.startswith("base64:"):
        return None
    if _PUBLIC_MINIO_PREFIX and url.startswith(_PUBLIC_MINIO_PREFIX):
        # MINIO_URL_PREFIX по умолчанию `http://localhost/images`, что внутри
        # nginx маппится в `http://minio:9000/`. Заменяем префикс полностью —
        # bucket уже включён дальше в пути.
        return MINIO_INTERNAL_URL + url[len(_PUBLIC_MINIO_PREFIX):]
    return url


def _collect_photos_from_catalog(asanas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Собирает фото со всех асан в формате для передачи нейросети."""
    out: List[Dict[str, Any]] = []
    for a in asanas:
        for p in a.get("photos") or []:
            image_url = _resolve_internal_image_url(p)
            dedup_fp = p.get("photo_dedup_fingerprint") or None
            if not image_url and not dedup_fp:
                continue
            out.append(
                {
                    "asana_id": a["id"],
                    "photo_id": p.get("id") or "",
                    "image_url": image_url,
                    "dedup_fp": dedup_fp,
                }
            )
    return out


def _build_photo_meta_map(asanas: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    """photo_id → {source, hash, dedup_fp}.

    Используется для отсева «шумных» пар, которые эксперту бесполезны:
    - одна и та же книга у обоих фото → авторское решение;
    - одинаковый photo_hash → буквально один и тот же файл, загруженный дважды;
    - одинаковый photo_dedup_fingerprint → визуально идентичные кадры
      (например, один и тот же скан, загруженный под разными названиями).
    """
    mapping: Dict[str, Dict[str, str]] = {}
    for a in asanas:
        for p in a.get("photos") or []:
            pid = p.get("id") or ""
            if not pid:
                continue
            mapping[pid] = {
                "source": p.get("source") or "",
                "hash": p.get("photo_hash") or "",
                "dedup_fp": p.get("photo_dedup_fingerprint") or "",
            }
    return mapping


def _pair_is_noise(meta_a: Dict[str, str], meta_b: Dict[str, str]) -> Optional[str]:
    """Возвращает причину, по которой пару нужно отбросить, либо None."""
    if not meta_a or not meta_b:
        return None
    sa, sb = meta_a.get("source"), meta_b.get("source")
    if sa and sb and sa == sb:
        return "same_source"
    ha, hb = meta_a.get("hash"), meta_b.get("hash")
    if ha and hb and ha == hb:
        return "identical_file"
    da, db = meta_a.get("dedup_fp"), meta_b.get("dedup_fp")
    if da and db and da == db:
        return "identical_image"
    return None


def _get_decided_photo_pairs() -> set[Tuple[str, str]]:
    """Пары photo_id, между которыми уже есть sameAs (asserted/inferred) или notSameAs."""
    from app.ontology import get_graph
    from app.photo_links import make_photo_uri, photo_pair_is_decided

    g = get_graph()
    seen: set[Tuple[str, str]] = set()
    from app.ontology import ASANA

    for photo in g.subjects(RDF.type, ASANA.AsanaPhoto):
        pid = str(photo)
        for other in g.subjects(RDF.type, ASANA.AsanaPhoto):
            oid = str(other)
            if pid >= oid:
                continue
            if photo_pair_is_decided(g, photo, other):
                seen.add(tuple(sorted([pid, oid])))
    return seen


def call_network_scan(
    photos: List[Dict[str, Any]],
    *,
    use_yoga_class: bool = True,
    yoga_class_threshold: float = 0.55,
) -> Dict[str, Any]:
    """
    Запрашивает у asana-network-service пакетный анализ. Возвращает
    {"proposals": [...], "photos_processed": int, "photos_failed": int}.
    """
    if not photos:
        return {"proposals": [], "photos_processed": 0, "photos_failed": 0}

    url = f"{NETWORK_SERVICE_URL}/ai/scan-duplicates"
    aggregated: Dict[str, Any] = {
        "proposals": [],
        "photos_processed": 0,
        "photos_failed": 0,
    }

    with httpx.Client(timeout=NETWORK_SERVICE_TIMEOUT) as client:
        for start in range(0, len(photos), NETWORK_SERVICE_BATCH_SIZE):
            chunk = photos[start : start + NETWORK_SERVICE_BATCH_SIZE]
            payload = {
                "photos": chunk,
                "use_yoga_class": use_yoga_class,
                "yoga_class_threshold": yoga_class_threshold,
            }
            logger.info(
                "AI scan: отправка батча %d фото в %s",
                len(chunk),
                url,
            )
            try:
                r = client.post(url, json=payload)
                r.raise_for_status()
                data = r.json() or {}
            except Exception as e:  # noqa: BLE001
                logger.error("AI scan: ошибка запроса к нейросети: %s", e)
                aggregated["photos_failed"] += len(chunk)
                continue
            aggregated["proposals"].extend(data.get("proposals") or [])
            aggregated["photos_processed"] += int(data.get("photos_processed") or 0)
            aggregated["photos_failed"] += int(data.get("photos_failed") or 0)
    return aggregated


def run_ai_scan_and_save(
    db: Session,
    *,
    use_yoga_class: bool = True,
    yoga_class_threshold: float = 0.55,
    skip_existing_links: bool = True,
) -> Dict[str, Any]:
    """
    Главная точка входа. Собирает фото из каталога, обращается к нейросети,
    фильтрует существующие связи и предложения, сохраняет новые в БД.
    """
    asanas = load_asanas()

    photos = _collect_photos_from_catalog(asanas)
    photo_meta_map = _build_photo_meta_map(asanas)
    logger.info("AI scan: найдено фото для анализа: %d", len(photos))

    existing_pairs = _get_decided_photo_pairs() if skip_existing_links else set()

    # Чистим старые мусорные предложения из БД — те, что уже стали «шумом»
    # (одна книга, одинаковый файл, одинаковый отпечаток).
    purged_noise = purge_noise_proposals(db, photo_meta_map)
    if purged_noise:
        logger.info("AI scan: удалено мусорных предложений из БД: %d", purged_noise)

    response = call_network_scan(
        photos,
        use_yoga_class=use_yoga_class,
        yoga_class_threshold=yoga_class_threshold,
    )

    raw_proposals = response.get("proposals") or []

    seen_keys = {
        row[0]
        for row in db.query(AISimilarityProposal.pair_key).all()
    }

    inserted = 0
    skipped_existing_link = 0
    skipped_dup = 0
    skipped_same_source = 0
    skipped_identical_photo = 0

    for proposal in raw_proposals:
        asana_a = proposal.get("asana_a_id")
        asana_b = proposal.get("asana_b_id")
        reason = proposal.get("reason") or "unknown"
        if not asana_a or not asana_b or asana_a == asana_b:
            continue

        photo_a_id = proposal.get("photo_a_id")
        photo_b_id = proposal.get("photo_b_id")
        if not photo_a_id or not photo_b_id:
            continue
        noise = _pair_is_noise(
            photo_meta_map.get(photo_a_id or "", {}),
            photo_meta_map.get(photo_b_id or "", {}),
        )
        if noise in ("identical_file", "identical_image"):
            skipped_identical_photo += 1
            continue

        pair_sorted = tuple(sorted([photo_a_id, photo_b_id]))
        if skip_existing_links and pair_sorted in existing_pairs:
            skipped_existing_link += 1
            continue
        pair_key = _make_pair_key(photo_a_id, photo_b_id, reason)
        if pair_key in seen_keys:
            skipped_dup += 1
            continue

        item = AISimilarityProposal(
            asana_a_id=pair_sorted[0],
            asana_b_id=pair_sorted[1],
            photo_a_id=photo_a_id,
            photo_b_id=photo_b_id,
            score=float(proposal.get("score") or 0.0),
            reason=reason,
            detail=proposal.get("detail"),
            status="pending",
            created_at=_now(),
            pair_key=pair_key,
        )
        db.add(item)
        seen_keys.add(pair_key)
        inserted += 1

    db.commit()
    return {
        "photos_total": len(photos),
        "photos_processed": response.get("photos_processed", 0),
        "photos_failed": response.get("photos_failed", 0),
        "proposals_returned": len(raw_proposals),
        "proposals_inserted": inserted,
        "purged_noise": purged_noise,
        "skipped_existing_link": skipped_existing_link,
        "skipped_duplicate": skipped_dup,
        "skipped_same_source": skipped_same_source,
        "skipped_identical_photo": skipped_identical_photo,
    }


def purge_noise_proposals(
    db: Session,
    photo_meta_map: Optional[Dict[str, Dict[str, str]]] = None,
) -> int:
    """Удаляет из БД pending-предложения, которые стали «шумом»:
    одна книга, одинаковый файл, одинаковый визуальный отпечаток.

    Возвращает количество удалённых записей. Не коммитит — это делает caller
    (например, `run_ai_scan_and_save` коммитит весь батч одной транзакцией).
    """
    if photo_meta_map is None:
        photo_meta_map = _build_photo_meta_map(load_asanas())

    rows = (
        db.query(AISimilarityProposal)
        .filter(AISimilarityProposal.status == "pending")
        .all()
    )
    purged = 0
    for row in rows:
        noise = _pair_is_noise(
            photo_meta_map.get(row.photo_a_id or "", {}),
            photo_meta_map.get(row.photo_b_id or "", {}),
        )
        if noise:
            db.delete(row)
            purged += 1
    return purged


def asana_short_id(uri: Optional[str]) -> str:
    if not uri:
        return ""
    if "#" in uri:
        return uri.split("#", 1)[1]
    return uri
