import logging
import os
import time

logger = logging.getLogger("asana_service.user_activity")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
ONLINE_WINDOW_SECONDS = int(os.getenv("USER_ONLINE_WINDOW_SECONDS", "300"))
VISITORS_SET_KEY = "catalog:visitors:v1"
ONLINE_ZSET_KEY = "catalog:online:v1"

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
            logger.warning("Redis unavailable for user activity: %s", exc)
            _redis_unavailable = True
            return None
    return _redis_client


def record_user_activity(login: str | None) -> None:
    if not login:
        return
    login = login.strip()
    if not login:
        return
    client = _client()
    if not client:
        return
    try:
        now = time.time()
        pipe = client.pipeline()
        pipe.sadd(VISITORS_SET_KEY, login)
        pipe.zadd(ONLINE_ZSET_KEY, {login: now})
        pipe.execute()
    except Exception as exc:
        logger.debug("Failed to record user activity: %s", exc)


def get_activity_metrics() -> tuple[int, int]:
    """Returns (unique_visitors_total, users_online)."""
    client = _client()
    if not client:
        return 0, 0
    try:
        cutoff = time.time() - ONLINE_WINDOW_SECONDS
        pipe = client.pipeline()
        pipe.zremrangebyscore(ONLINE_ZSET_KEY, 0, cutoff)
        pipe.zcard(ONLINE_ZSET_KEY)
        pipe.scard(VISITORS_SET_KEY)
        _, online, visitors = pipe.execute()
        return int(visitors or 0), int(online or 0)
    except Exception as exc:
        logger.debug("Failed to read user activity metrics: %s", exc)
        return 0, 0
