"""Нормализация SMTP_* из окружения."""

from __future__ import annotations

import os


def smtp_host() -> str:
    for key in ("SMTP_HOST", "SMTP_SERVER"):
        val = (os.getenv(key) or "").strip()
        if not val:
            continue
        if ":" in val and not val.startswith("["):
            val = val.rsplit(":", 1)[0].strip()
        return val
    return "smtp.yandex.ru"


def smtp_port(default: int = 465) -> int:
    raw = (os.getenv("SMTP_PORT") or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default
