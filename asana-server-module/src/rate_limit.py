"""Ограничение частоты запросов (Redis) для чувствительных auth-операций."""

from __future__ import annotations

import logging
import os

from fastapi import HTTPException, Request
from starlette import status

logger = logging.getLogger("server_module.rate_limit")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Запрос кода сброса: по IP и по введённому логину/email
PWRESET_REQUEST_LIMIT_IP = int(os.getenv("PASSWORD_RESET_REQUEST_LIMIT_IP", "5"))
PWRESET_REQUEST_LIMIT_LOGIN = int(os.getenv("PASSWORD_RESET_REQUEST_LIMIT_LOGIN", "3"))
PWRESET_VERIFY_LIMIT_IP = int(os.getenv("PASSWORD_RESET_VERIFY_LIMIT_IP", "15"))
PWRESET_VERIFY_LIMIT_LOGIN = int(os.getenv("PASSWORD_RESET_VERIFY_LIMIT_LOGIN", "8"))
PWRESET_CONFIRM_LIMIT_IP = int(os.getenv("PASSWORD_RESET_CONFIRM_LIMIT_IP", "10"))
PWRESET_WINDOW_SECONDS = int(os.getenv("PASSWORD_RESET_RATE_WINDOW_SECONDS", "900"))

_redis_client = None
_redis_unavailable = False


def _client():
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is None:
        try:
            import redis

            _redis_client = redis.Redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _redis_client.ping()
        except Exception as exc:
            logger.warning("Redis unavailable for rate limit: %s", exc)
            _redis_unavailable = True
            return None
    return _redis_client


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _normalize_login(login: str | None) -> str:
    return (login or "").strip().lower()[:256] or "empty"


def _hit(key: str, limit: int, window_seconds: int) -> tuple[int, int]:
    """Возвращает (счётчик после инкремента, ttl секунд)."""
    client = _client()
    if not client:
        return 0, window_seconds
    try:
        count = int(client.incr(key))
        if count == 1:
            client.expire(key, window_seconds)
        ttl = client.ttl(key)
        return count, ttl if ttl and ttl > 0 else window_seconds
    except Exception as exc:
        logger.debug("Rate limit check failed for %s: %s", key, exc)
        return 0, window_seconds


def _too_many(limit: int, count: int, ttl: int) -> HTTPException:
    minutes = max(1, (ttl + 59) // 60)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Слишком много попыток. Повторите через {minutes} мин.",
        headers={"Retry-After": str(ttl)},
    )


def enforce_password_reset_request_limit(request: Request, login: str) -> None:
    ip = _client_ip(request)
    norm = _normalize_login(login)
    window = PWRESET_WINDOW_SECONDS

    for key, limit in (
        (f"pwreset:request:ip:{ip}", PWRESET_REQUEST_LIMIT_IP),
        (f"pwreset:request:login:{norm}", PWRESET_REQUEST_LIMIT_LOGIN),
    ):
        count, ttl = _hit(key, limit, window)
        if count > limit:
            raise _too_many(limit, count, ttl)


def enforce_password_reset_verify_limit(request: Request, login: str) -> None:
    ip = _client_ip(request)
    norm = _normalize_login(login)
    window = PWRESET_WINDOW_SECONDS

    for key, limit in (
        (f"pwreset:verify:ip:{ip}", PWRESET_VERIFY_LIMIT_IP),
        (f"pwreset:verify:login:{norm}", PWRESET_VERIFY_LIMIT_LOGIN),
    ):
        count, ttl = _hit(key, limit, window)
        if count > limit:
            raise _too_many(limit, count, ttl)


def enforce_password_reset_confirm_limit(request: Request, login: str) -> None:
    ip = _client_ip(request)
    norm = _normalize_login(login)
    window = PWRESET_WINDOW_SECONDS

    for key, limit in (
        (f"pwreset:confirm:ip:{ip}", PWRESET_CONFIRM_LIMIT_IP),
        (f"pwreset:confirm:login:{norm}", PWRESET_VERIFY_LIMIT_LOGIN),
    ):
        count, ttl = _hit(key, limit, window)
        if count > limit:
            raise _too_many(limit, count, ttl)
