from __future__ import annotations

import os

import httpx
from fastapi import Header, HTTPException, Request

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://server-module:8000").rstrip("/")


def require_admin(
    request: Request,
    authorization: str | None = Header(default=None),
) -> str:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = (request.cookies.get("access_token") or "").strip() or None
    if not token:
        raise HTTPException(status_code=401, detail="Token not found")

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{AUTH_SERVICE_URL}/api/users/me",
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
