"""
Хранение состояния фоновых задач импорта (общее для нескольких реплик asana-import).
При REDIS_URL — Redis; иначе память процесса (только один воркер).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger("asana_service.import_task_storage")

_memory: Dict[str, Dict[str, Any]] = {}
_redis = None  # lazy
_use_memory: bool = False


def _redis_client():
    global _redis, _use_memory
    if _use_memory:
        return None
    if _redis is not None:
        return _redis
    url = (os.getenv("REDIS_URL") or "").strip()
    if not url:
        logger.warning("REDIS_URL не задан — статусы импорта только в памяти (не для scale).")
        _use_memory = True
        return None
    try:
        import redis

        _redis = redis.from_url(url, decode_responses=True)
        _redis.ping()
        logger.info("Redis для import tasks: OK")
        return _redis
    except Exception as e:
        logger.error("Redis недоступен: %s — fallback in-memory", e)
        _use_memory = True
        return None


def task_get(task_id: str) -> Optional[Dict[str, Any]]:
    r = _redis_client()
    if r:
        raw = r.get(f"dict:import_task:{task_id}")
        if raw:
            return json.loads(raw)
        return None
    return _memory.get(task_id)


def task_set(task_id: str, data: Dict[str, Any], ttl_seconds: int = 86400) -> None:
    r = _redis_client()
    if r:
        r.setex(f"dict:import_task:{task_id}", ttl_seconds, json.dumps(data, default=str))
    else:
        _memory[task_id] = data


def task_delete(task_id: str) -> None:
    r = _redis_client()
    if r:
        r.delete(f"dict:import_task:{task_id}")
    else:
        _memory.pop(task_id, None)


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
    r = _redis_client()
    if not r:
        return False
    return bool(r.exists(OWL_WRITE_LOCK_KEY))


def try_acquire_owl_write_lock(holder: str, ttl_seconds: Optional[int] = None) -> bool:
    """
    Пытается захватить эксклюзивную блокировку на запись OWL.
    Без Redis — всегда True (один локальный процесс / dev); в лог пишется предупреждение при первом обращении к Redis.
    """
    r = _redis_client()
    ttl = ttl_seconds if ttl_seconds is not None else OWL_WRITE_LOCK_TTL_SECONDS
    if not r:
        return True
    return bool(r.set(OWL_WRITE_LOCK_KEY, holder, nx=True, ex=ttl))


def release_owl_write_lock(holder: str) -> None:
    """Снимает блокировку, только если её держит тот же holder (Lua-скрипт)."""
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
