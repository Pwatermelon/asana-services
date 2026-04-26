"""
Отпечаток для поиска дубликатов фото с учётом поворотов 0/90/180/270°.
MD5 байтов файла остаётся в photoHash (целостность / S3); сравнение «то же изображение»
использует photoDedupFingerprint (инвариант к кратному 90° повороту контента).
"""
from __future__ import annotations

import base64
import hashlib
import logging
from io import BytesIO
from typing import Optional, Tuple

from PIL import Image, ImageOps

logger = logging.getLogger("asana_service.photo_dedup")

try:
    import imagehash
except ImportError:  # pragma: no cover
    imagehash = None  # type: ignore


def norm_dedup_fp(val: Optional[str]) -> str:
    if val is None:
        return ""
    return str(val).strip().lower()


def norm_md5_hex(val: Optional[str]) -> str:
    if val is None:
        return ""
    return str(val).strip().lower()


def compute_photo_dedup_fingerprint(image_data: bytes | str) -> str:
    """
    SHA-256 от отсортированного списка pHash (8×8) для изображения,
    повёрнутого на 0°, 90°, 180°, 270° (одинаковый результат для одной и той же картинки
    с точностью до поворота на прямой угол).

    image_data: bytes или base64 / data URL (как у compute_image_hash).
    """
    try:
        if isinstance(image_data, bytes):
            image_bytes = image_data
        else:
            s = str(image_data)
            if "," in s:
                s = s.split(",", 1)[1]
            s = s.strip().replace("\n", "").replace("\r", "").replace(" ", "")
            if not s:
                return ""
            image_bytes = base64.b64decode(s, validate=True)
    except Exception as e:
        logger.warning("photo_dedup: decode failed: %s", e)
        return ""

    if not image_bytes or len(image_bytes) < 40:
        return ""
    if imagehash is None:
        logger.warning("photo_dedup: imagehash не установлен, dedup fingerprint пустой")
        return ""
    try:
        im = Image.open(BytesIO(image_bytes))
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA", "L"):
            im = im.convert("RGB")
        elif im.mode == "L":
            im = im.convert("RGB")
        elif im.mode == "RGBA":
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[3])
            im = bg

        hashes: list[str] = []
        for k in range(4):
            rot = im.rotate(-90 * k, expand=True, resample=Image.Resampling.BICUBIC)
            h = imagehash.phash(rot, hash_size=8)
            hashes.append(str(h))
        canonical = "|".join(sorted(hashes))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except Exception as e:
        logger.warning("photo_dedup: не удалось вычислить fingerprint: %s", e)
        return ""


def is_same_photo_for_dedup(
    cand_md5: str,
    cand_dedup: str,
    existing_md5: str,
    existing_dedup: str,
) -> bool:
    """Дубликат, если совпал rotation-invariant fingerprint или (оба без dedup) совпал MD5."""
    cd, ed = norm_dedup_fp(cand_dedup), norm_dedup_fp(existing_dedup)
    if cd and ed and cd == ed:
        return True
    cm, em = norm_md5_hex(cand_md5), norm_md5_hex(existing_md5)
    if cm and em and cm == em:
        return True
    return False


def photo_matches_any_existing(
    cand_md5: str,
    cand_dedup: str,
    existing_pairs: list[Tuple[str, str]],
) -> bool:
    for em, ed in existing_pairs:
        if is_same_photo_for_dedup(cand_md5, cand_dedup, em, ed):
            return True
    return False


def rotate_image_bytes(image_bytes: bytes, degrees: int) -> bytes:
    """
    Поворот на 90/180/270 по часовой стрелке (expand=True).
    JPEG остаётся JPEG, остальное — PNG в байтах (ключ S3 не меняется).
    """
    if degrees not in (90, 180, 270):
        raise ValueError("degrees must be 90, 180 or 270")
    im = Image.open(BytesIO(image_bytes))
    im = ImageOps.exif_transpose(im)
    fmt = (im.format or "").upper()
    is_jpeg = fmt in ("JPEG", "JPG", "MPO") or image_bytes[:2] == b"\xff\xd8"
    rotated = im.rotate(-degrees, expand=True, resample=Image.Resampling.BICUBIC)
    buf = BytesIO()
    if is_jpeg:
        rgb = rotated.convert("RGB")
        rgb.save(buf, format="JPEG", quality=92, optimize=True)
    else:
        if rotated.mode in ("RGBA", "P"):
            rotated.save(buf, format="PNG", optimize=True)
        else:
            rotated.convert("RGB").save(buf, format="PNG", optimize=True)
    out = buf.getvalue()
    if not out:
        raise ValueError("empty image after rotate")
    return out
