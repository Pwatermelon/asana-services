"""Формирование понятных записей аудита для админ-панели."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qs

# Поля, которые никогда не пишем в аудит
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "new_password",
        "old_password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "smtp_password",
    }
)

_ACTION_RULES: list[tuple[str, str, str, str]] = [
    # method, path prefix or exact, action_code, human label (специфичные пути — выше)
    ("DELETE", "/api/asanas", "asana.delete", "Удаление асаны"),
    ("DELETE", "/api/delete-source", "source.delete", "Удаление источника"),
    ("DELETE", "/api/delete-asana-name", "asana_name.delete", "Удаление названия асаны"),
    ("DELETE", "/api/users/", "user.delete", "Удаление пользователя"),
    ("PATCH", "/api/users/", "user.update", "Изменение пользователя"),
    ("POST", "/api/users", "user.create", "Создание пользователя"),
    ("POST", "/api/asana", "asana.create", "Создание асаны"),
    ("POST", "/api/sources", "source.create", "Создание источника"),
    ("PUT", "/api/sources/", "source.update", "Изменение источника"),
    ("POST", "/api/asana-names", "asana_name.create", "Создание названия асаны"),
    ("PATCH", "/api/asana-names", "asana_name.update", "Изменение названия асаны"),
    ("POST", "/api/about-project", "content.about.update", "Обновление «О проекте»"),
    ("POST", "/api/expert-instructions", "content.instructions.update", "Обновление инструкций эксперта"),
    ("DELETE", "/api/moderation/", "moderation.delete", "Очистка модерации"),
    ("POST", "/api/moderation/", "moderation.add", "Добавление в модерацию"),
    ("PATCH", "/api/ai/proposals/", "ai.proposal", "Действие с AI-предложением"),
    ("DELETE", "/api/ai/proposals/", "ai.proposals.clear", "Очистка AI-предложений"),
    ("POST", "/api/ai/scan", "ai.scan", "Запуск AI-сканирования"),
    ("POST", "/api/import/", "import.run", "Импорт данных"),
    ("DELETE", "/api/import/", "import.delete", "Удаление импорта"),
]


def short_uri(uri: str | None) -> str | None:
    if not uri:
        return None
    uri = str(uri).strip()
    if "#" in uri:
        return uri.split("#", 1)[-1]
    return uri.rstrip("/").split("/")[-1] or uri


def _match_action(method: str, path: str) -> tuple[str, str]:
    method = method.upper()
    special: list[tuple[str, str, str, str]] = [
        ("POST", "/block", "user.block", "Блокировка пользователя"),
        ("POST", "/unblock", "user.unblock", "Разблокировка пользователя"),
        ("DELETE", "/photo/", "asana.photo.delete", "Удаление фото асаны"),
        ("POST", "/add-photo", "asana.photo.add", "Добавление фото к асане"),
        ("POST", "/rotate", "asana.photo.rotate", "Поворот фото асаны"),
        ("PUT", "/photo/", "asana.photo.replace", "Замена фото асаны"),
        ("DELETE", "/same-as/", "asana.same_as.remove", "Удаление связи sameAs"),
        ("POST", "/same-as", "asana.same_as.add", "Добавление связи sameAs"),
        ("PATCH", "/confirm", "ai.proposal.confirm", "Подтверждение AI-предложения"),
        ("PATCH", "/reject", "ai.proposal.reject", "Отклонение AI-предложения"),
    ]
    for sm, fragment, code, label in special:
        if method == sm and fragment in path:
            return code, label

    for rule_method, rule_path, code, label in _ACTION_RULES:
        if method != rule_method:
            continue
        if path == rule_path or path.rstrip("/") == rule_path.rstrip("/"):
            return code, label
        if rule_path.endswith("/") and path.startswith(rule_path):
            return code, label
        # /api/sources/{id} — только для правил с завершающим /
        if rule_path.endswith("/"):
            continue
    slug = path.strip("/").replace("/", ".") or "root"
    return f"{method.lower()}.{slug}", f"{method} {path}"


def _sanitize_mapping(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in data.items():
        if key.lower() in _SENSITIVE_KEYS:
            continue
        if isinstance(value, dict):
            nested = _sanitize_mapping(value)
            if nested:
                out[key] = nested
        elif value is not None and value != "":
            if isinstance(value, (str, int, float, bool)):
                text = str(value)
                if len(text) > 500:
                    text = text[:500] + "…"
                out[key] = text
    return out


def parse_request_body(raw: bytes, content_type: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    ctype = (content_type or "").lower()
    if "application/json" in ctype:
        try:
            data = json.loads(raw.decode("utf-8"))
            if isinstance(data, dict):
                return _sanitize_mapping(data)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}
    if "application/x-www-form-urlencoded" in ctype:
        try:
            parsed = parse_qs(raw.decode("utf-8"), keep_blank_values=False)
            flat = {k: (v[0] if len(v) == 1 else v) for k, v in parsed.items()}
            return _sanitize_mapping(flat)
        except UnicodeDecodeError:
            return {}
    return {}


def _extract_path_ids(path: str) -> dict[str, str]:
    cleaned = (path or "").strip("/")
    parts = cleaned.split("/")
    if parts and parts[0] == "api":
        parts = parts[1:]
    ctx: dict[str, str] = {}
    if not parts:
        return ctx
    if parts[0] == "asana" and len(parts) > 1:
        ctx["asana_id"] = parts[1]
    if parts[0] == "users" and len(parts) > 1 and parts[1].isdigit():
        ctx["user_id"] = parts[1]
    if parts[0] == "sources" and len(parts) > 1:
        ctx["source_id"] = parts[1]
    if parts[0] == "ai" and parts[0:2] == ["ai", "proposals"] and len(parts) > 2:
        ctx["proposal_id"] = parts[2]
    if "photo" in parts:
        idx = parts.index("photo")
        if idx + 1 < len(parts):
            ctx["photo_id"] = parts[idx + 1]
    if "same-as" in parts:
        idx = parts.index("same-as")
        if idx + 1 < len(parts):
            ctx["target_asana_id"] = parts[idx + 1]
    return ctx


def prefetch_entity_context(method: str, path: str, query: dict[str, str]) -> dict[str, Any]:
    """До выполнения handler: подтянуть названия сущностей (важно для DELETE)."""
    uri = query.get("uri") or query.get("id")
    ctx: dict[str, Any] = {}

    try:
        if method == "DELETE" and path.rstrip("/") == "/api/asanas" and uri:
            from app.ontology import load_asanas

            for asana in load_asanas():
                if asana.get("id") == uri:
                    name = (asana.get("name") or {})
                    ctx["entity_type"] = "asana"
                    ctx["entity_id"] = short_uri(uri)
                    ctx["uri"] = uri
                    ctx["name_ru"] = name.get("name_ru") or name.get("ru")
                    break
            if not ctx.get("name_ru"):
                ctx["entity_type"] = "asana"
                ctx["entity_id"] = short_uri(uri)
                ctx["uri"] = uri

        elif method == "DELETE" and "/api/delete-source" in path and uri:
            from app.ontology import load_sources

            for src in load_sources():
                if src.get("id") == uri:
                    ctx["entity_type"] = "source"
                    ctx["entity_id"] = short_uri(uri)
                    ctx["uri"] = uri
                    ctx["title"] = src.get("title") or src.get("name")
                    break
            else:
                ctx["entity_type"] = "source"
                ctx["entity_id"] = short_uri(uri)
                ctx["uri"] = uri

        elif method == "DELETE" and "/api/delete-asana-name" in path and uri:
            from app.ontology import load_asana_names

            for item in load_asana_names():
                if item.get("id") == uri:
                    ctx["entity_type"] = "asana_name"
                    ctx["entity_id"] = short_uri(uri)
                    ctx["uri"] = uri
                    ctx["name_ru"] = item.get("name_ru") or item.get("ru")
                    break
            else:
                ctx["entity_type"] = "asana_name"
                ctx["entity_id"] = short_uri(uri)
                ctx["uri"] = uri

        elif path.startswith("/api/asana/") and method in ("DELETE", "PUT", "POST"):
            path_ctx = _extract_path_ids(path)
            asana_id = path_ctx.get("asana_id")
            if asana_id:
                from app.ontology import load_asanas

                full = asana_id
                if not full.startswith("http"):
                    full = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{'asana_' + full.replace('asana_', '')}"
                for asana in load_asanas():
                    aid = asana.get("id", "")
                    if aid == full or short_uri(aid) == short_uri(asana_id):
                        name = (asana.get("name") or {})
                        ctx["entity_type"] = "asana"
                        ctx["entity_id"] = short_uri(aid)
                        ctx["name_ru"] = name.get("name_ru") or name.get("ru")
                        break
    except Exception:
        pass

    return ctx


def build_audit_payload(
    *,
    method: str,
    path: str,
    query_params: dict[str, str],
    body: dict[str, Any],
    status_code: int,
    duration_ms: int,
    prefetched: dict[str, Any] | None = None,
) -> dict[str, Any]:
    action_code, action_label = _match_action(method, path)
    path_ctx = _extract_path_ids(path)
    prefetched = prefetched or {}

    entity_type = prefetched.get("entity_type") or path_ctx.get("entity_type")
    entity_id = (
        prefetched.get("entity_id")
        or query_params.get("uri")
        or query_params.get("id")
        or path_ctx.get("asana_id")
        or path_ctx.get("user_id")
        or path_ctx.get("source_id")
        or path_ctx.get("proposal_id")
    )
    if entity_id and isinstance(entity_id, str) and entity_id.startswith("http"):
        entity_id = short_uri(entity_id)

    target: dict[str, Any] = {}
    for key in (
        "name_ru",
        "name_en",
        "name_sanskrit",
        "title",
        "login",
        "email",
        "uri",
        "asana_id",
        "user_id",
        "source_id",
        "photo_id",
        "proposal_id",
        "target_asana_id",
    ):
        val = prefetched.get(key) or body.get(key) or path_ctx.get(key) or query_params.get(key)
        if val:
            target[key] = val

    for nested_key in ("name", "new_name"):
        nested = body.get(nested_key)
        if isinstance(nested, dict):
            for k, v in nested.items():
                if k not in _SENSITIVE_KEYS and v:
                    target.setdefault(k, v)

    summary_parts: list[str] = []
    if target.get("name_ru"):
        summary_parts.append(f"«{target['name_ru']}»")
    elif target.get("title"):
        summary_parts.append(f"«{target['title']}»")
    if target.get("login"):
        summary_parts.append(f"пользователь {target['login']}")
    if target.get("email") and not target.get("login"):
        summary_parts.append(target["email"])
    if target.get("uri"):
        summary_parts.append(f"id: {short_uri(target['uri'])}")
    elif entity_id:
        summary_parts.append(f"id: {entity_id}")
    if path_ctx.get("photo_id"):
        summary_parts.append(f"фото {short_uri(path_ctx['photo_id'])}")
    if path_ctx.get("target_asana_id"):
        summary_parts.append(f"связь с {path_ctx['target_asana_id']}")

    summary = action_label
    if summary_parts:
        summary = f"{action_label}: {' · '.join(summary_parts)}"

    details = {
        "summary": summary,
        "label": action_label,
        "target": target,
        "query": query_params or None,
        "body": body or None,
        "duration_ms": duration_ms,
        "status_code": status_code,
    }

    if not entity_type:
        cleaned = path.strip("/").split("/")
        if cleaned and cleaned[0] == "api" and len(cleaned) > 1:
            entity_type = cleaned[1].replace("-", "_")

    return {
        "action_code": action_code,
        "action_label": action_label,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None,
        "summary": summary,
        "details": details,
    }
