"""Нормализация SMTP_* из окружения (кавычки, пробелы, опечатки в .env / compose)."""

from __future__ import annotations

import os
import re

_DEFAULT_HOST = "smtp.yandex.ru"
_HOST_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$")
_EMAIL_JUNK = "{}'\"$` "
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    val = str(value).strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
        val = val[1:-1].strip()
    return val


def _strip_junk(val: str) -> str:
    val = val.strip(_EMAIL_JUNK)
    while val and val[0] in _EMAIL_JUNK:
        val = val[1:]
    while val and val[-1] in _EMAIL_JUNK:
        val = val[:-1]
    return val.strip()


def _normalize_host(raw: str) -> str:
    val = _clean(raw)
    if not val or "${" in val or val.startswith("$"):
        return ""
    val = _strip_junk(val)
    if ":" in val and not val.startswith("["):
        val = val.rsplit(":", 1)[0].strip()
    val = _strip_junk(val)
    if not _HOST_RE.match(val):
        val = re.sub(r"[^a-zA-Z0-9.-]+$", "", val)
        val = re.sub(r"^[^a-zA-Z0-9]+", "", val)
    return val.strip()


def _normalize_email(raw: str) -> str:
    """Убирает } из platinumwatermelon@yandex.ru} (баг compose ${SMTP_FROM:-${SMTP_USER}})."""
    val = _strip_junk(_clean(raw))
    if not val or "${" in val or val.startswith("$"):
        return ""
    if "@" in val:
        val = re.sub(r"[^a-zA-Z0-9._%+-@]+$", "", val)
        val = re.sub(r"^[^a-zA-Z0-9._%+-]+", "", val)
    return val.strip()


def smtp_host() -> str:
    for key in ("SMTP_HOST", "SMTP_SERVER"):
        val = _normalize_host(os.getenv(key) or "")
        if val:
            return val
    return _DEFAULT_HOST


def smtp_port(default: int = 465) -> int:
    raw = _strip_junk(_clean(os.getenv("SMTP_PORT")))
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def smtp_user() -> str:
    return _normalize_email(os.getenv("SMTP_USER") or "")


def smtp_password() -> str:
    return _strip_junk(_clean(os.getenv("SMTP_PASSWORD")))


def smtp_from(default_user: str | None = None) -> str:
    val = _normalize_email(os.getenv("SMTP_FROM") or "")
    if val:
        return val
    user = _normalize_email(default_user or "") if default_user else smtp_user()
    return user or "noreply@your-domain.com"
