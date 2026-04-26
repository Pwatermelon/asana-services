"""
Извлечение байтов изображения из сохранённого import_data записи модерации.
Поддерживает поля: photo (data URL / base64 / http URL), photo_base64, photo_url,
_staged_import_photos (после Excel staging — только s3_path в bucket).
"""
import base64
import json
import logging
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("asana_service.moderation_photo")


def parse_moderation_item_import(import_data_raw: Any) -> Optional[Dict]:
    if import_data_raw is None:
        return None
    if isinstance(import_data_raw, dict):
        return import_data_raw
    if isinstance(import_data_raw, str):
        try:
            return json.loads(import_data_raw)
        except Exception as e:
            logger.warning(f"parse_moderation_item_import: JSON error: {e}")
            return None
    return None


def _is_usable_preview_src(s: str) -> bool:
    t = s.strip()
    if not t:
        return False
    if t.startswith(("http://", "https://")):
        return True
    if t.startswith("data:image/") and "," in t and len(t) < 4_500_000:
        return True
    return False


def moderation_import_photo_urls(import_data: Optional[Dict]) -> List[str]:
    """
    Публичные URL или data URL для каждого изображения (те же объекты в MinIO, без отдельного превью-слоя).
    Собираем из _staged_import_photos и встроенных photo/photos; игнорируем устаревший одиночный photo_preview_urls в JSON,
    пока есть реальные источники.
    """
    if not isinstance(import_data, dict):
        return []
    from app.s3_utils import get_s3_url

    out: List[str] = []

    def _add_path(s3_path: Optional[str]) -> None:
        if not isinstance(s3_path, str):
            return
        sp = s3_path.strip()
        if not sp or sp.startswith("data:"):
            return
        try:
            out.append(get_s3_url(sp))
        except Exception as e:
            logger.warning("moderation_import_photo_urls: get_s3_url failed for %s: %s", sp[:80], e)

    def _add_inline(s: Optional[str]) -> None:
        if not isinstance(s, str):
            return
        t = s.strip()
        if not t:
            return
        if t.startswith(("http://", "https://", "data:image/")) and _is_usable_preview_src(t):
            out.append(t)
            return
        if t.startswith("images/") and "://" not in t:
            _add_path(t)

    staged = import_data.get("_staged_import_photos") or []
    if isinstance(staged, list):
        for e in staged:
            if isinstance(e, dict):
                _add_path(e.get("s3_path"))

    _add_inline(import_data.get("photo"))

    pl = import_data.get("photos")
    if isinstance(pl, list):
        for p in pl:
            _add_inline(p)

    # убрать дубликаты, сохранить порядок
    seen = set()
    uniq: List[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    if uniq:
        return uniq

    # Fallback: старые записи без staged/embed в JSON — только сохранённые превью
    cached = import_data.get("photo_preview_urls")
    if isinstance(cached, list) and cached:
        fb: List[str] = []
        seen_c = set()
        for u in cached:
            if not isinstance(u, str):
                continue
            t = u.strip()
            if not _is_usable_preview_src(t):
                continue
            if t not in seen_c:
                seen_c.add(t)
                fb.append(t)
        return fb
    return []


def enrich_moderation_import_data(import_data: Optional[Dict]) -> Optional[Dict]:
    """Добавляет import_photo_urls, photo_preview_urls (совместимость) и photo_url — первое изображение."""
    if not isinstance(import_data, dict):
        return import_data
    d = dict(import_data)
    # Старые записи в БД могли накопить одинаковые staged по хешу; убираем перед списком URL (без цикла excel↔moderation на уровне модуля).
    try:
        from app.excel_import import _dedupe_moderation_staged_photos_in_place

        _dedupe_moderation_staged_photos_in_place(d)
    except Exception:
        pass
    urls = moderation_import_photo_urls(d)
    if not urls:
        return d
    d["import_photo_urls"] = urls
    d["photo_preview_urls"] = urls
    first = urls[0]
    cur = d.get("photo_url")
    if not cur or not isinstance(cur, str) or not (
        cur.strip().startswith("http") or cur.strip().startswith("data:image/")
    ):
        d["photo_url"] = first
    return d


def _bytes_from_data_or_b64_string(s: str) -> Optional[bytes]:
    t = s.strip()
    if not t:
        return None
    if t.startswith("data:") and "," in t:
        try:
            b64 = t.split(",", 1)[1].strip().replace("\n", "").replace("\r", "").replace(" ", "")
            b = base64.b64decode(b64, validate=False)
            return b if b and len(b) >= 40 else None
        except Exception:
            return None
    if len(t) > 60 and not t.startswith("http") and not t.startswith("images/"):
        try:
            clean = t.replace("\n", "").replace("\r", "").replace(" ", "")
            b = base64.b64decode(clean, validate=False)
            return b if b and len(b) >= 40 else None
        except Exception:
            return None
    return None


def moderation_export_image_bytes_list(import_data: Optional[Dict]) -> List[bytes]:
    """
    Байты каждого изображения в порядке как при импорте (staging → встроенные photos).
    Сначала чтение из MinIO (оригинал), при сбое — HTTP по тому же пути.
    Без склейки в одну картинку: вызывающий (Excel) вставляет по одному на строку.
    """
    if not isinstance(import_data, dict):
        return []
    out: List[bytes] = []
    from app.s3_utils import get_s3_object_bytes, get_s3_url

    staged = import_data.get("_staged_import_photos") or []
    if isinstance(staged, list):
        for e in staged:
            if not isinstance(e, dict):
                continue
            sp = e.get("s3_path")
            if not isinstance(sp, str) or not sp.strip():
                continue
            sp = sp.strip()
            b = get_s3_object_bytes(sp)
            if not b or len(b) < 40:
                try:
                    u = get_s3_url(sp)
                    req = Request(u, headers={"User-Agent": "AsanaDictService/1.0"})
                    with urlopen(req, timeout=120) as resp:
                        b = resp.read()
                except (URLError, OSError, ValueError) as ex:
                    logger.warning("moderation_export_image_bytes_list: MinIO+HTTP failed for %s: %s", sp[:80], ex)
                    b = None
            if b and len(b) >= 40:
                out.append(b)

    if out:
        return out

    photos_raw = import_data.get("photos")
    if isinstance(photos_raw, list):
        for p in photos_raw:
            if not isinstance(p, str) or not p.strip():
                continue
            b = _bytes_from_data_or_b64_string(p)
            if b:
                out.append(b)

    one = import_data.get("photo")
    if isinstance(one, str) and one.strip() and not out:
        b = _bytes_from_data_or_b64_string(one)
        if b:
            out.append(b)

    if out:
        return out

    for url in moderation_import_photo_urls(import_data):
        if not isinstance(url, str):
            continue
        if url.startswith("data:image/") and "," in url:
            b = _bytes_from_data_or_b64_string(url)
            if b:
                out.append(b)
            continue
        if not url.startswith("http"):
            continue
        try:
            req = Request(url, headers={"User-Agent": "AsanaDictService/1.0"})
            with urlopen(req, timeout=120) as resp:
                b = resp.read()
                if b and len(b) >= 40:
                    out.append(b)
        except (URLError, OSError, ValueError) as e:
            logger.warning("moderation_export_image_bytes_list: fetch %s: %s", url[:96], e)

    if not out:
        fb = image_bytes_from_import_dict(import_data)
        if fb and len(fb) >= 40:
            out.append(fb)

    return out


# Совместимость со старым именем
moderation_import_photo_preview_urls = moderation_import_photo_urls


def image_bytes_from_import_dict(import_data: Dict) -> Optional[bytes]:
    if not isinstance(import_data, dict):
        return None

    # Сначала уже залитые в S3 (staging) — по HTTP; либо data URL из превью
    for u in moderation_import_photo_urls(import_data):
        if isinstance(u, str) and u.startswith("data:image/") and "," in u:
            try:
                b64 = u.split(",", 1)[1].strip().replace("\n", "").replace("\r", "").replace(" ", "")
                data = base64.b64decode(b64, validate=False)
                if data and len(data) > 50:
                    return data
            except Exception as e:
                logger.warning("image_bytes: data URL decode failed: %s", e)
            continue
        if not isinstance(u, str) or not u.startswith("http"):
            continue
        try:
            req = Request(u, headers={"User-Agent": "AsanaDictService/1.0"})
            with urlopen(req, timeout=45) as resp:
                data = resp.read()
                if data and len(data) > 50:
                    return data
        except (URLError, OSError, ValueError) as e:
            logger.warning("image_bytes: staged/S3 URL fetch failed: %s", e)

    # 0) Несколько фото в массиве photos (импорт Excel)
    photos_list = import_data.get("photos")
    if isinstance(photos_list, list) and photos_list:
        for p in photos_list:
            if not isinstance(p, str) or not p.strip():
                continue
            b = image_bytes_from_import_dict({**import_data, "photo": p, "photos": []})
            if b:
                return b

    # 1) Явный URL
    for key in ("photo_url", "photo"):
        val = import_data.get(key)
        if isinstance(val, str):
            u = val.strip()
            if u.startswith(("http://", "https://")):
                try:
                    req = Request(u, headers={"User-Agent": "AsanaDictService/1.0"})
                    with urlopen(req, timeout=45) as resp:
                        return resp.read()
                except (URLError, OSError, ValueError) as e:
                    logger.warning(f"image_bytes: URL fetch failed for {key}: {e}")

    # 2) data: URL или сырой base64 в photo / photo_base64
    for key in ("photo_base64", "photo"):
        val = import_data.get(key)
        if val is None or not isinstance(val, str):
            continue
        s = val.strip()
        if not s or s.startswith(("http://", "https://")):
            continue
        if s.startswith("data:"):
            try:
                if "," not in s:
                    continue
                b64 = s.split(",", 1)[1].strip()
                b64 = b64.replace("\n", "").replace("\r", "").replace(" ", "")
                return base64.b64decode(b64, validate=False)
            except Exception as e:
                logger.warning(f"image_bytes: data URL decode failed ({key}): {e}")
                continue
        # длинная строка — пробуем как чистый base64
        if len(s) > 40:
            try:
                clean = s.replace("\n", "").replace("\r", "").replace(" ", "")
                return base64.b64decode(clean, validate=False)
            except Exception:
                continue

    return None
