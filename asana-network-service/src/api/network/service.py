import base64
import hashlib
import logging
import os
from datetime import datetime
from io import BytesIO
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageOps

from src.api.network.schemas import (
    PhotoIn,
    PredictIn,
    PredictOut,
    ProposalOut,
    ScanIn,
    ScanOut,
)
from src.utils.network import predict_model, predict_top1_class

logger = logging.getLogger("asana_network.service")

try:
    import imagehash  # type: ignore
except ImportError:  # pragma: no cover
    imagehash = None  # type: ignore

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover
    requests = None  # type: ignore


def _decode_base64_image(s: str) -> bytes:
    """Декодирует base64 (с data:URL префиксом или без) в байты."""
    if not s:
        raise ValueError("empty base64 image")
    payload = s
    if "," in payload:
        payload = payload.split(",", 1)[1]
    payload = payload.strip().replace("\n", "").replace("\r", "").replace(" ", "")
    return base64.b64decode(payload, validate=True)


def _download_bytes(url: str, timeout: float = 10.0) -> bytes:
    """Загружает байты по HTTP/S, возвращает содержимое (raise при ошибке)."""
    if requests is None:
        raise RuntimeError("Library 'requests' is not installed in network service")
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def _compute_dedup_fingerprint(image_bytes: bytes) -> Optional[str]:
    """
    Rotation-invariant pHash 8x8: SHA-256 от отсортированных pHash для поворотов 0/90/180/270°.
    Совпадает с asana-dict-service.photo_dedup.compute_photo_dedup_fingerprint.
    """
    if not image_bytes or imagehash is None:
        return None
    try:
        im = Image.open(BytesIO(image_bytes))
        im = ImageOps.exif_transpose(im)
        if im.mode == "RGBA":
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[3])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
        hashes: List[str] = []
        for k in range(4):
            rot = im.rotate(-90 * k, expand=True, resample=Image.Resampling.BICUBIC)
            hashes.append(str(imagehash.phash(rot, hash_size=8)))
        canonical = "|".join(sorted(hashes))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except Exception as e:  # noqa: BLE001
        logger.warning("dedup fingerprint failed: %s", e)
        return None


class _ProcessedPhoto:
    __slots__ = ("photo", "dedup_fp", "yoga_class", "yoga_conf")

    def __init__(
        self,
        photo: PhotoIn,
        dedup_fp: Optional[str],
        yoga_class: Optional[int],
        yoga_conf: float,
    ):
        self.photo = photo
        self.dedup_fp = dedup_fp
        self.yoga_class = yoga_class
        self.yoga_conf = yoga_conf


class NetworkService:
    """
    Сервис нейросети.
    - predict: классификация одиночного изображения (legacy).
    - scan_duplicates: пакетный поиск похожих фото между разными асанами для
      постановки в очередь модерации isSameAs.
    """

    # ----- legacy (классификация одиночного изображения) -----
    def base64_to_image(self, image: str) -> str:
        image_bytes = _decode_base64_image(image)
        pil = Image.open(BytesIO(image_bytes))

        os.makedirs("./images_for_predict", exist_ok=True)
        timestamp = int(datetime.now().timestamp() * 1000)
        file_name = f"./images_for_predict/image{timestamp}.png"
        pil.save(file_name)
        return file_name

    def predict(self, image: PredictIn) -> PredictOut:
        path_to_image = self.base64_to_image(image.image)
        try:
            classes = predict_model(path_to_image)
        finally:
            try:
                os.remove(path_to_image)
            except OSError:
                pass
        return PredictOut(classes=list(classes or []))

    # ----- batch scan для модерации isSameAs -----
    def _load_image_bytes(self, p: PhotoIn) -> Optional[bytes]:
        try:
            if p.image_base64:
                return _decode_base64_image(p.image_base64)
            if p.image_url:
                return _download_bytes(p.image_url)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "не удалось получить изображение для photo_id=%s url=%s: %s",
                p.photo_id,
                p.image_url,
                e,
            )
        return None

    def _process_photo(
        self, p: PhotoIn, *, use_yoga_class: bool
    ) -> Tuple[Optional[_ProcessedPhoto], Optional[str]]:
        """
        Возвращает (ProcessedPhoto или None, причина_отказа или None).
        Фото остаётся «обработанным», если получилось хоть что-нибудь:
        либо dedup_fp (для phash_exact), либо yoga_class (для yoga_class).
        Если ни того, ни другого — фото не учитываем (photos_failed++).
        """
        dedup_fp = (p.dedup_fp or "").strip().lower() or None
        yoga_class: Optional[int] = None
        yoga_conf: float = 0.0

        # Качать байты надо только если у нас ещё нет dedup_fp ИЛИ нужен класс YOLO.
        need_bytes = (dedup_fp is None) or use_yoga_class
        image_bytes: Optional[bytes] = None
        load_error: Optional[str] = None
        if need_bytes:
            image_bytes = self._load_image_bytes(p)
            if image_bytes is None:
                load_error = "image_load_failed"

        if dedup_fp is None and image_bytes is not None:
            dedup_fp = _compute_dedup_fingerprint(image_bytes)

        if use_yoga_class and image_bytes is not None:
            try:
                yoga_class, yoga_conf = predict_top1_class(image_bytes)
            except Exception as e:  # noqa: BLE001
                logger.warning("yoga predict failed for photo_id=%s: %s", p.photo_id, e)
                yoga_class, yoga_conf = None, 0.0

        if dedup_fp is None and yoga_class is None:
            return None, load_error or "no_signal"

        return _ProcessedPhoto(p, dedup_fp, yoga_class, yoga_conf), None

    def scan_duplicates(self, payload: ScanIn) -> ScanOut:
        photos = list(payload.photos or [])
        logger.info("scan_duplicates start: %d фото", len(photos))

        processed: List[_ProcessedPhoto] = []
        failed = 0
        load_errors = 0
        for p in photos:
            r, err = self._process_photo(p, use_yoga_class=payload.use_yoga_class)
            if err == "image_load_failed":
                load_errors += 1
            if r is None:
                failed += 1
                continue
            processed.append(r)
        if load_errors:
            logger.warning(
                "scan_duplicates: не удалось скачать %d/%d изображений — "
                "phash_exact будет работать только по уже посчитанному dedup_fp, "
                "yoga_class по ним посчитан не будет.",
                load_errors,
                len(photos),
            )

        proposals: List[ProposalOut] = []
        seen_pairs: set[Tuple[str, str, str]] = set()  # (asana_a, asana_b, reason)

        def _emit(a: _ProcessedPhoto, b: _ProcessedPhoto, score: float, reason: str, detail: Optional[str] = None) -> None:
            asa_a, asa_b = a.photo.asana_id, b.photo.asana_id
            if asa_a == asa_b:
                return
            # Канонизируем порядок асан: a < b — чтобы не дублировать пары.
            if asa_a > asa_b:
                a, b = b, a
                asa_a, asa_b = asa_b, asa_a
            key = (asa_a, asa_b, reason)
            if key in seen_pairs:
                return
            seen_pairs.add(key)
            proposals.append(
                ProposalOut(
                    asana_a_id=asa_a,
                    asana_b_id=asa_b,
                    photo_a_id=a.photo.photo_id,
                    photo_b_id=b.photo.photo_id,
                    score=round(float(score), 4),
                    reason=reason,
                    detail=detail,
                )
            )

        # 1) точное совпадение rotation-invariant pHash → высокая уверенность
        by_fp: Dict[str, List[_ProcessedPhoto]] = {}
        for r in processed:
            if r.dedup_fp:
                by_fp.setdefault(r.dedup_fp, []).append(r)
        for fp, group in by_fp.items():
            if len(group) < 2:
                continue
            # Пары с разными asana_id внутри группы: одно и то же изображение → isSameAs.
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    _emit(group[i], group[j], 1.0, "phash_exact", detail=f"fp={fp[:12]}…")

        # 2) совпадение top-1 класса YOLO (poses из yoga-82) → мягкое предложение
        if payload.use_yoga_class:
            by_class: Dict[int, List[_ProcessedPhoto]] = {}
            for r in processed:
                if r.yoga_class is not None and r.yoga_conf >= payload.yoga_class_threshold:
                    by_class.setdefault(int(r.yoga_class), []).append(r)
            for cls, group in by_class.items():
                if len(group) < 2:
                    continue
                for i in range(len(group)):
                    for j in range(i + 1, len(group)):
                        score = (group[i].yoga_conf + group[j].yoga_conf) / 2.0
                        _emit(
                            group[i],
                            group[j],
                            score,
                            "yoga_class",
                            detail=f"class={cls}",
                        )

        logger.info(
            "scan_duplicates done: processed=%d failed=%d proposals=%d",
            len(processed),
            failed,
            len(proposals),
        )
        return ScanOut(
            proposals=proposals,
            photos_processed=len(processed),
            photos_failed=failed,
        )
