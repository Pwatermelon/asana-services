"""Проверка админа через server-module /api/users/me."""
from __future__ import annotations

import httpx
from fastapi import Header, HTTPException, Request


def _token_from_request(request: Request, authorization: str | None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    cookie = request.cookies.get("access_token")
    if cookie:
        return cookie.strip()
    raise HTTPException(status_code=401, detail="Token not found")


def require_admin(
    request: Request,
    authorization: str | None = Header(default=None),
) -> str:
    from config import settings

    token = _token_from_request(request, authorization)
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{settings.AUTH_SERVICE_URL}/api/users/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-DB-Schema": "dict_schema",
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Auth service unavailable: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    data = resp.json() if resp.content else {}
    login = (data.get("login") or "").strip()
    if not login:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    if not data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Требуется роль администратора")
    return login
