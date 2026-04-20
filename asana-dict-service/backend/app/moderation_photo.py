"""
Извлечение байтов изображения из сохранённого import_data записи модерации.
Поддерживает поля: photo (data URL / base64 / http URL), photo_base64, photo_url.
"""
import base64
import json
import logging
from typing import Any, Dict, Optional
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


def image_bytes_from_import_dict(import_data: Dict) -> Optional[bytes]:
    if not isinstance(import_data, dict):
        return None

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
