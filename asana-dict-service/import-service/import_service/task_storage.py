"""
Хранение состояния фоновых задач импорта (общее для нескольких реплик asana-import).
При REDIS_URL — только Redis (без «навсегда в память» при одном сбое ping — иначе при scale>1
каждая реплика считает себя единственной и ломает блокировку OWL и статусы).
Без REDIS_URL — память процесса (один воркер / dev).
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("asana_service.import_task_storage")

_memory: Dict[str, Dict[str, Any]] = {}
_redis: Optional[Any] = None
_warned_no_redis_url: bool = False


def _redis_url() -> str:
    return (os.getenv("REDIS_URL") or "").strip()


def _use_in_memory_tasks() -> bool:
    """Только если REDIS_URL не задан — иначе задачи и lock обязаны идти через Redis при scale."""
    return not bool(_redis_url())


def _redis_socket_connect_timeout() -> float:
    return float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5"))


def _redis_socket_timeout() -> float:
    """Иначе r.get/ping при «зависшем» TCP к Redis могут блокировать воркер навсегда."""
    return float(os.getenv("REDIS_SOCKET_TIMEOUT", "10"))


def _connect_redis_with_retries(url: str, attempts: int = 12, base_delay_sec: float = 0.25) -> Any:
    import redis

    last_err: Optional[BaseException] = None
    for i in range(1, attempts + 1):
        try:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=_redis_socket_connect_timeout(),
                socket_timeout=_redis_socket_timeout(),
            )
            client.ping()
            return client
        except Exception as e:
            last_err = e
            delay = min(3.0, base_delay_sec * (2 ** min(i - 1, 4)))
            time.sleep(delay)
    raise last_err  # type: ignore[misc]


def _redis_client() -> Optional[Any]:
    """
    Возвращает клиент Redis или None (только в режиме in-memory задач).
    При заданном REDIS_URL повторяет подключение; не переключается навсегда в память.
    """
    global _redis, _warned_no_redis_url
    if _use_in_memory_tasks():
        if not _warned_no_redis_url:
            logger.warning("REDIS_URL не задан — статусы импорта только в памяти процесса (не для scale).")
            _warned_no_redis_url = True
        return None

    url = _redis_url()
    if _redis is not None:
        try:
            _redis.ping()
            return _redis
        except Exception as e:
            logger.warning("Redis ping failed, reconnecting: %s", e)
            _redis = None

    try:
        _redis = _connect_redis_with_retries(url)
        logger.info("Redis для import tasks: OK")
        return _redis
    except Exception as e:
        logger.error(
            "Redis недоступен при заданном REDIS_URL: %s — статусы/блокировка OWL не работают до восстановления Redis",
            e,
        )
        _redis = None
        return None


def task_get(task_id: str) -> Optional[Dict[str, Any]]:
    if _use_in_memory_tasks():
        return _memory.get(task_id)
    r = _redis_client()
    if not r:
        return None
    raw = r.get(f"dict:import_task:{task_id}")
    if raw:
        return json.loads(raw)
    return None


def task_set(task_id: str, data: Dict[str, Any], ttl_seconds: int = 86400) -> None:
    if _use_in_memory_tasks():
        _memory[task_id] = data
        return
    r = _redis_client()
    if not r:
        raise RuntimeError(
            "REDIS_URL задан, но Redis недоступен: нельзя сохранить статус импорта. "
            "Проверьте сервис redis, сеть и depends_on (service_healthy)."
        )
    r.setex(f"dict:import_task:{task_id}", ttl_seconds, json.dumps(data, default=str))


def task_delete(task_id: str) -> None:
    if _use_in_memory_tasks():
        _memory.pop(task_id, None)
        return
    r = _redis_client()
    if r:
        r.delete(f"dict:import_task:{task_id}")


def task_update(task_id: str, **updates: Any) -> None:
    cur = task_get(task_id) or {}
    cur.update(updates)
    task_set(task_id, cur)


# --- Глобальная блокировка записи в OWL (один writer на кластер при REDIS_URL) ---
OWL_WRITE_LOCK_KEY = "dict:owl_write_lock"
OWL_WRITE_LOCK_TTL_SECONDS = int(os.getenv("OWL_IMPORT_LOCK_TTL_SECONDS", "7200"))
OWL_WRITE_BUSY_DETAIL = (
    "Сейчас выполняется другая запись в онтологию (импорт или загрузка OWL). "
    "Дождитесь завершения и повторите."
)


def is_owl_write_locked() -> bool:
    """True, если другой процесс держит блокировку записи в онтологию."""
    if _use_in_memory_tasks():
        return False
    r = _redis_client()
    if not r:
        return False
    return bool(r.exists(OWL_WRITE_LOCK_KEY))


def try_acquire_owl_write_lock(holder: str, ttl_seconds: Optional[int] = None) -> bool:
    """
    Эксклюзивная блокировка на запись OWL.
    Без REDIS_URL — True (один локальный процесс / dev).
    С REDIS_URL, но Redis недоступен — False (не считаем, что lock «свободен»: иначе несколько реплик пишут OWL).
    """
    if _use_in_memory_tasks():
        return True
    r = _redis_client()
    if not r:
        logger.error(
            "try_acquire_owl_write_lock: Redis недоступен при заданном REDIS_URL — отказ (holder=%s)",
            holder,
        )
        return False
    ttl = ttl_seconds if ttl_seconds is not None else OWL_WRITE_LOCK_TTL_SECONDS
    return bool(r.set(OWL_WRITE_LOCK_KEY, holder, nx=True, ex=ttl))


def release_owl_write_lock(holder: str) -> None:
    """Снимает блокировку, только если её держит тот же holder (Lua-скрипт)."""
    if _use_in_memory_tasks():
        return
    r = _redis_client()
    if not r:
        return
    r.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        OWL_WRITE_LOCK_KEY,
        holder,
    )


def touch_owl_write_lock(holder: str, ttl_seconds: Optional[int] = None) -> None:
    """Продлить TTL блокировки (для долгих импортов), только если holder совпадает."""
    if _use_in_memory_tasks():
        return
    r = _redis_client()
    if not r:
        return
    ttl = ttl_seconds if ttl_seconds is not None else OWL_WRITE_LOCK_TTL_SECONDS
    r.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
        1,
        OWL_WRITE_LOCK_KEY,
        holder,
        str(ttl),
    )
