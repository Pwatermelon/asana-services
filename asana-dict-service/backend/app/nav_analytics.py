"""
AsanaNavPath — средство интеллектуального анализа навигации по каталогу.

Методы (методы ИАД):
- нормализация путей (обобщение URL → паттерны);
- реконструкция сессий;
- матрица переходов первого порядка (цепь Маркова);
- частые маршруты (n-граммы переходов);
- статистики страниц: входы, выходы, просмотры;
- адаптивный контур: рекомендации следующего шага и переупорядочивание UI.
"""
from __future__ import annotations

import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence

# Канонические публичные зоны каталога
KNOWN_EXACT = {
    "/",
    "/asanas",
    "/sources",
    "/about",
    "/login",
    "/profile",
    "/admin",
    "/users",
    "/settings",
    "/moderation",
    "/names",
    "/ai-moderation",
    "/expert-instructions",
    "/asana/add",
    "/sources/add",
}

PATTERN_LABELS = {
    "/": "Главная",
    "/asanas": "Каталог асан",
    "/sources": "Источники",
    "/about": "О проекте",
    "/login": "Вход",
    "/profile": "Профиль",
    "/asana/:id": "Карточка асаны",
    "/asana/:id-page": "Страница асаны",
    "/sources/:id/asanas": "Асаны источника",
    "/sources/:id/edit": "Редактирование источника",
    "/asana/add": "Добавление асаны",
    "/sources/add": "Добавление источника",
    "/expert-instructions": "Инструкции эксперта",
    "/moderation": "Модерация",
    "/ai-moderation": "ИИ-модерация",
    "/names": "Названия",
    "/settings": "Настройки",
    "/admin": "Администрирование",
}

# Публичные пункты меню, которые можно переупорядочивать по популярности
ADAPTIVE_NAV_KEYS = ("/asanas", "/sources", "/about")

# Минимум наблюдений, после которого включаем адаптацию UI
MIN_EVENTS_FOR_ADAPT = 12
MIN_TRANSITION_COUNT = 2

_guide_cache: Dict[str, Any] = {"ts": 0.0, "payload": None}
_GUIDE_TTL_SEC = 90.0


def normalize_path(raw: str | None) -> str:
    if not raw:
        return "/"
    path = str(raw).split("?", 1)[0].split("#", 1)[0].strip() or "/"
    if not path.startswith("/"):
        path = "/" + path
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path or "/"


def path_to_pattern(path: str) -> str:
    """Обобщение конкретного URL до шаблона для анализа закономерностей."""
    p = normalize_path(path)
    if p in KNOWN_EXACT:
        return p
    if p.startswith("/asana/") and p.endswith("-page"):
        return "/asana/:id-page"
    if re.match(r"^/asana/[^/]+$", p):
        return "/asana/:id"
    if re.match(r"^/sources/[^/]+/asanas$", p):
        return "/sources/:id/asanas"
    if re.match(r"^/sources/[^/]+/edit$", p):
        return "/sources/:id/edit"
    if p.startswith("/api/"):
        return "/api/*"
    if len(p) > 64:
        return p[:64] + "…"
    return p


def pattern_label(pattern: str) -> str:
    return PATTERN_LABELS.get(pattern, pattern)


def _parse_ts(value: str) -> datetime:
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.now(timezone.utc)


def reconstruct_sessions(
    events: Sequence[Any],
    *,
    idle_gap_seconds: int = 1800,
) -> List[List[Any]]:
    """Группирует события в сессии по session_id и разрыву по времени."""
    by_sid_list: Dict[str, List[Any]] = defaultdict(list)
    for ev in events:
        by_sid_list[str(ev.session_id)].append(ev)

    sessions: List[List[Any]] = []
    for rows in by_sid_list.values():
        rows.sort(key=lambda e: e.created_at or "")
        current: List[Any] = []
        prev_ts: Optional[datetime] = None
        for ev in rows:
            ts = _parse_ts(ev.created_at)
            if current and prev_ts and (ts - prev_ts).total_seconds() > idle_gap_seconds:
                sessions.append(current)
                current = []
            current.append(ev)
            prev_ts = ts
        if current:
            sessions.append(current)
    return sessions


def build_markov_transitions(
    sessions: Iterable[Sequence[Any]],
    *,
    top_n: int = 40,
) -> List[Dict[str, Any]]:
    """Первый порядок: P(B|A) ≈ count(A→B) / count(A→*)."""
    pair_counts: Counter = Counter()
    out_counts: Counter = Counter()
    for session in sessions:
        patterns = [e.path_pattern for e in session if getattr(e, "path_pattern", None)]
        for i in range(len(patterns) - 1):
            a, b = patterns[i], patterns[i + 1]
            if a == b:
                continue
            pair_counts[(a, b)] += 1
            out_counts[a] += 1

    rows: List[Dict[str, Any]] = []
    for (a, b), cnt in pair_counts.most_common(top_n):
        total = out_counts[a] or 1
        rows.append(
            {
                "from": a,
                "to": b,
                "count": int(cnt),
                "probability": round(cnt / total, 4),
            }
        )
    return rows


def frequent_routes(
    sessions: Iterable[Sequence[Any]],
    *,
    min_len: int = 2,
    max_len: int = 4,
    top_n: int = 25,
) -> List[Dict[str, Any]]:
    """Частые маршруты как n-граммы паттернов страниц."""
    route_counts: Counter = Counter()
    for session in sessions:
        patterns = [e.path_pattern for e in session if getattr(e, "path_pattern", None)]
        n = len(patterns)
        for length in range(min_len, min(max_len, n) + 1):
            for i in range(n - length + 1):
                gram = tuple(patterns[i : i + length])
                if len(set(gram)) < 2:
                    continue
                route_counts[gram] += 1

    rows: List[Dict[str, Any]] = []
    for gram, cnt in route_counts.most_common(top_n):
        rows.append(
            {
                "route": list(gram),
                "route_label": " → ".join(gram),
                "count": int(cnt),
                "length": len(gram),
            }
        )
    return rows


def page_statistics(sessions: Iterable[Sequence[Any]]) -> List[Dict[str, Any]]:
    views: Counter = Counter()
    entries: Counter = Counter()
    exits: Counter = Counter()
    sessions_touch: Dict[str, set] = defaultdict(set)

    for idx, session in enumerate(sessions):
        patterns = [e.path_pattern for e in session if getattr(e, "path_pattern", None)]
        if not patterns:
            continue
        for p in patterns:
            views[p] += 1
            sessions_touch[p].add(idx)
        entries[patterns[0]] += 1
        exits[patterns[-1]] += 1

    pages = set(views) | set(entries) | set(exits)
    rows = []
    for p in pages:
        rows.append(
            {
                "page": p,
                "views": int(views[p]),
                "unique_sessions": len(sessions_touch[p]),
                "entries": int(entries[p]),
                "exits": int(exits[p]),
            }
        )
    rows.sort(key=lambda r: (-r["views"], r["page"]))
    return rows


def build_insights(
    pages: Sequence[Dict[str, Any]],
    transitions: Sequence[Dict[str, Any]],
    routes: Sequence[Dict[str, Any]],
    session_count: int,
    event_count: int,
) -> List[str]:
    insights: List[str] = []
    insights.append(
        f"За выбранный период зафиксировано {event_count} просмотров в {session_count} сессиях."
    )
    if pages:
        top = pages[0]
        insights.append(
            f"Самая посещаемая страница-паттерн: «{top['page']}» ({top['views']} просмотров)."
        )
        entry = max(pages, key=lambda r: r["entries"])
        if entry["entries"]:
            insights.append(
                f"Частая точка входа: «{entry['page']}» ({entry['entries']} сессий)."
            )
        exit_p = max(pages, key=lambda r: r["exits"])
        if exit_p["exits"]:
            insights.append(
                f"Частая точка выхода: «{exit_p['page']}» ({exit_p['exits']} сессий)."
            )
    if transitions:
        t = transitions[0]
        insights.append(
            f"Сильнейший переход: «{t['from']}» → «{t['to']}» "
            f"(n={t['count']}, P≈{t['probability']})."
        )
    if routes:
        r = routes[0]
        insights.append(f"Частый маршрут: {r['route_label']} (n={r['count']}).")
    if session_count and event_count:
        avg = round(event_count / max(session_count, 1), 2)
        insights.append(f"Средняя длина сессии: {avg} просмотров.")
    return insights


def _asana_id_from_path(path: str) -> Optional[str]:
    p = normalize_path(path)
    m = re.match(r"^/asana/([^/]+)$", p)
    if not m:
        return None
    aid = m.group(1)
    if aid == "add":
        return None
    if aid.endswith("-page"):
        aid = aid[: -len("-page")]
    return aid or None


def _source_id_from_asanas_path(path: str) -> Optional[str]:
    p = normalize_path(path)
    m = re.match(r"^/sources/([^/]+)/asanas$", p)
    return m.group(1) if m else None


def _best_concrete_href(
    pattern: str,
    asana_views: Counter,
    source_views: Counter,
) -> Optional[str]:
    if pattern in KNOWN_EXACT:
        return pattern if pattern != "/" else "/asanas"
    if pattern in ("/asana/:id", "/asana/:id-page") and asana_views:
        aid = asana_views.most_common(1)[0][0]
        return f"/asana/{aid}-page"
    if pattern == "/sources/:id/asanas" and source_views:
        sid = source_views.most_common(1)[0][0]
        return f"/sources/{sid}/asanas"
    return None


def build_adaptive_actions(
    events: Sequence[Any],
    sessions: Sequence[Sequence[Any]],
    transitions: Sequence[Dict[str, Any]],
    pages: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Преобразует закономерности в действия, меняющие поведение UI:
    - next_steps_by_pattern: куда вести пользователя с текущей страницы;
    - nav_order: порядок пунктов меню;
    - popular_asanas / popular_sources: сущности для поднятия в списках;
    - applied_rules: человекочитаемое описание включённых правил.
    """
    asana_views: Counter = Counter()
    source_views: Counter = Counter()
    for ev in events:
        path = getattr(ev, "path", None) or ""
        aid = _asana_id_from_path(path)
        if aid:
            asana_views[aid] += 1
        sid = _source_id_from_asanas_path(path)
        if sid:
            source_views[sid] += 1

    next_map: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for t in transitions:
        if t["count"] < MIN_TRANSITION_COUNT:
            continue
        href = _best_concrete_href(t["to"], asana_views, source_views)
        if not href:
            continue
        next_map[t["from"]].append(
            {
                "to_pattern": t["to"],
                "label": pattern_label(t["to"]),
                "href": href,
                "count": t["count"],
                "probability": t["probability"],
            }
        )

    views_by_page = {p["page"]: p["views"] for p in pages}
    nav_scored = sorted(
        ADAPTIVE_NAV_KEYS,
        key=lambda k: (-views_by_page.get(k, 0), ADAPTIVE_NAV_KEYS.index(k)),
    )

    popular_asanas = [
        {"id": aid, "path": f"/asana/{aid}-page", "views": int(cnt)}
        for aid, cnt in asana_views.most_common(12)
    ]
    popular_sources = [
        {"id": sid, "path": f"/sources/{sid}/asanas", "views": int(cnt)}
        for sid, cnt in source_views.most_common(12)
    ]

    adaptive_enabled = len(events) >= MIN_EVENTS_FOR_ADAPT
    applied: List[str] = []
    if adaptive_enabled:
        applied.append(
            "Включена адаптация UI: порог доказательности по числу просмотров пройден."
        )
        if nav_scored != list(ADAPTIVE_NAV_KEYS):
            applied.append(
                "Порядок пунктов меню перестроен по популярности: "
                + " → ".join(pattern_label(x) for x in nav_scored)
            )
        if popular_asanas:
            applied.append(
                f"В каталоге поднимаются часто просматриваемые асаны "
                f"(топ-{min(5, len(popular_asanas))})."
            )
        if popular_sources:
            applied.append(
                f"В списке источников поднимаются часто открываемые карточки "
                f"(топ-{min(5, len(popular_sources))})."
            )
        strong = [t for t in transitions if t["count"] >= MIN_TRANSITION_COUNT][:3]
        for t in strong:
            applied.append(
                f"Подсказка перехода «{pattern_label(t['from'])}» → "
                f"«{pattern_label(t['to'])}» (P≈{t['probability']})."
            )
    else:
        applied.append(
            f"Адаптация UI пока в режиме наблюдения "
            f"(нужно ≥{MIN_EVENTS_FOR_ADAPT} просмотров, сейчас {len(events)})."
        )

    return {
        "adaptive_enabled": adaptive_enabled,
        "min_events_required": MIN_EVENTS_FOR_ADAPT,
        "next_steps_by_pattern": {k: v[:5] for k, v in next_map.items()},
        "nav_order": list(nav_scored),
        "popular_asanas": popular_asanas,
        "popular_sources": popular_sources,
        "applied_rules": applied,
    }


def analyze_events(
    events: Sequence[Any],
    *,
    idle_gap_seconds: int = 1800,
) -> Dict[str, Any]:
    sessions = reconstruct_sessions(events, idle_gap_seconds=idle_gap_seconds)
    transitions = build_markov_transitions(sessions)
    routes = frequent_routes(sessions)
    pages = page_statistics(sessions)
    adaptive = build_adaptive_actions(events, sessions, transitions, pages)
    return {
        "event_count": len(events),
        "session_count": len(sessions),
        "pages": pages[:50],
        "transitions": transitions,
        "routes": routes,
        "insights": build_insights(
            pages, transitions, routes, len(sessions), len(events)
        ),
        "adaptive": adaptive,
        "method": {
            "name": "AsanaNavPath",
            "models": [
                "session_reconstruction",
                "first_order_markov",
                "frequent_route_ngrams",
                "page_funnel_stats",
                "closed_loop_ui_adaptation",
            ],
        },
    }


def guide_for_path(analysis: Dict[str, Any], path: str | None) -> Dict[str, Any]:
    """Публичная выдача подсказок для конкретного экрана SPA."""
    adaptive = analysis.get("adaptive") or {}
    pattern = path_to_pattern(path or "/")
    next_steps = list(
        (adaptive.get("next_steps_by_pattern") or {}).get(pattern, [])
    )
    if not next_steps and pattern.startswith("/asana/"):
        next_steps = list(
            (adaptive.get("next_steps_by_pattern") or {}).get("/asana/:id", [])
        )
    if not next_steps and pattern.startswith("/sources/") and pattern.endswith("/asanas"):
        next_steps = list(
            (adaptive.get("next_steps_by_pattern") or {}).get("/sources/:id/asanas", [])
        )

    return {
        "path": normalize_path(path) if path else "/",
        "pattern": pattern,
        "adaptive_enabled": bool(adaptive.get("adaptive_enabled")),
        "next_steps": next_steps,
        "nav_order": adaptive.get("nav_order") or list(ADAPTIVE_NAV_KEYS),
        "popular_asanas": adaptive.get("popular_asanas") or [],
        "popular_sources": adaptive.get("popular_sources") or [],
        "applied_rules": adaptive.get("applied_rules") or [],
        "event_count": analysis.get("event_count", 0),
        "session_count": analysis.get("session_count", 0),
    }


def period_start(days: int) -> str:
    days = max(1, min(int(days or 7), 90))
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def invalidate_guide_cache() -> None:
    _guide_cache["ts"] = 0.0
    _guide_cache["payload"] = None


def get_cached_analysis(payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    if payload is not None:
        _guide_cache["payload"] = payload
        _guide_cache["ts"] = time.time()
        return payload
    if _guide_cache["payload"] and (time.time() - float(_guide_cache["ts"])) < _GUIDE_TTL_SEC:
        return _guide_cache["payload"]
    return None
