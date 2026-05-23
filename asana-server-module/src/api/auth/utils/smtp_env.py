"""Нормализация SMTP_* из окружения (кавычки, пробелы, пустой хост)."""

from __future__ import annotations

import os


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    val = str(value).strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
        val = val[1:-1].strip()
    return val


def smtp_host() -> str:
    for key in ("SMTP_HOST", "SMTP_SERVER"):
        val = _clean(os.getenv(key))
        if not val:
            continue
        if ":" in val and not val.startswith("["):
            val = val.rsplit(":", 1)[0].strip()
        return val
    return "smtp.yandex.ru"


def smtp_port(default: int = 465) -> int:
    raw = _clean(os.getenv("SMTP_PORT"))
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def smtp_user() -> str:
    return _clean(os.getenv("SMTP_USER"))


def smtp_password() -> str:
    return _clean(os.getenv("SMTP_PASSWORD"))


def smtp_from(default_user: str | None = None) -> str:
    val = _clean(os.getenv("SMTP_FROM"))
    if val:
        return val
    user = default_user if default_user is not None else smtp_user()
    return user or "noreply@your-domain.com"
