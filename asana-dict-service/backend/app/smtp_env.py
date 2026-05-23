"""Нормализация SMTP_* из окружения."""

from __future__ import annotations

import os
import re

_DEFAULT_HOST = "smtp.yandex.ru"
_HOST_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$")


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    val = str(value).strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
        val = val[1:-1].strip()
    return val


def _normalize_host(raw: str) -> str:
    val = _clean(raw)
    if not val:
        return ""
    if "${" in val or val.startswith("$"):
        return ""
    val = val.strip("{}'\"$` ")
    if ":" in val and not val.startswith("["):
        val = val.rsplit(":", 1)[0].strip()
    val = val.strip("{}'\"$` ")
    if not _HOST_RE.match(val):
        val = re.sub(r"[^a-zA-Z0-9.-]+$", "", val)
        val = re.sub(r"^[^a-zA-Z0-9]+", "", val)
    return val.strip()


def smtp_host() -> str:
    for key in ("SMTP_HOST", "SMTP_SERVER"):
        val = _normalize_host(os.getenv(key) or "")
        if val:
            return val
    return _DEFAULT_HOST


def smtp_port(default: int = 465) -> int:
    raw = _clean(os.getenv("SMTP_PORT"))
    if not raw:
        return default
    raw = raw.rstrip("}'\" ")
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
