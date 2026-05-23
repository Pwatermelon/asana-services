"""
Отдельное приложение FastAPI: импорт/экспорт Excel, онтология, экспорт модерации.
Запуск: uvicorn import_service.main:app
Общий код каталога — пакет app (../backend/app в репозитории, монтируется/копируется в образ).
"""
import time
import json
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app import config
from app.auth import get_user_info_from_token_sync
from app.audit_context import build_audit_payload, parse_request_body, should_record_audit
from app.config import logger
from app.models import AuditEvent
from app.main import SessionLocal, HTTP_REQUESTS_TOTAL, HTTP_REQUEST_DURATION_SECONDS
from import_service.routes import router as import_router

app = FastAPI(
    title=f"{config.APP_NAME} — import/export",
    description="Импорт и экспорт данных каталога (Excel, онтология)",
    version=config.APP_VERSION,
    docs_url="/api/import/docs",
    redoc_url="/api/import/redoc",
    openapi_url="/api/import/openapi.json",
)

class DocsAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        protected_paths = ["/api/import/docs", "/api/import/redoc", "/api/import/openapi.json"]
        is_protected = any(
            path == protected or path.startswith(protected + "/") for protected in protected_paths
        )
        if is_protected:
            token = (
                request.headers.get("Authorization", "").replace("Bearer ", "")
                or request.cookies.get("access_token")
                or request.cookies.get("session_token")
            )
            if not token:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Требуется авторизация для доступа к документации API"},
                )
            try:
                user_data = get_user_info_from_token_sync(token)
                if not user_data:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Недействительный токен авторизации"},
                    )
                is_admin_flag = user_data.get("is_admin", False)
                if not is_admin_flag:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "Доступ к документации API разрешен только администраторам"
                        },
                    )
            except Exception as e:
                logger.error("Error checking auth in docs middleware: %s", e)
                return JSONResponse(status_code=401, content={"detail": "Ошибка проверки авторизации"})
        response = await call_next(request)
        return response


class AuditMiddleware(BaseHTTPMiddleware):
    _track_methods = {"POST", "PATCH", "PUT", "DELETE"}
    _skip_prefixes = ("/api/import/docs", "/api/import/redoc", "/api/import/openapi.json", "/metrics")

    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        method = request.method.upper()
        should_track = method in self._track_methods and not any(
            path.startswith(prefix) for prefix in self._skip_prefixes
        )
        body_raw = b""
        if should_track:
            body_raw = await request.body()

            async def receive():
                return {"type": "http.request", "body": body_raw, "more_body": False}

            request._receive = receive

        start = datetime.utcnow()
        response = await call_next(request)

        if not should_track or SessionLocal is None:
            return response

        token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
        user_data = get_user_info_from_token_sync(token) if token else None

        if not should_record_audit(
            method=method,
            path=path,
            status_code=int(response.status_code),
            user_data=user_data,
        ):
            return response

        body_data = parse_request_body(body_raw, request.headers.get("content-type"))
        duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        audit = build_audit_payload(
            method=method,
            path=path,
            query_params=dict(request.query_params),
            body=body_data,
            status_code=int(response.status_code),
            duration_ms=duration_ms,
            prefetched={},
        )
        if user_data.get("is_admin"):
            audit["details"]["actor_role"] = "admin"
        elif user_data.get("permission_study"):
            audit["details"]["actor_role"] = "expert"

        db = SessionLocal()
        try:
            event = AuditEvent(
                timestamp=datetime.utcnow().isoformat(),
                login=user_data.get("login"),
                avatar_url=user_data.get("avatar_url"),
                method=method,
                path=path,
                status_code=int(response.status_code),
                action_code=audit["action_code"],
                entity_type=audit.get("entity_type"),
                entity_id=audit.get("entity_id"),
                ip=(request.client.host if request.client else None),
                details=json.dumps(audit["details"], ensure_ascii=False),
            )
            db.add(event)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to write import audit event: %s", exc)
        finally:
            db.close()
        return response


app.add_middleware(DocsAuthMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_router)


@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    HTTP_REQUESTS_TOTAL.labels("asana-import", request.method, request.url.path, str(response.status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels("asana-import", request.method, request.url.path).observe(elapsed)
    return response


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.on_event("startup")
async def startup_event():
    from app.main import run_application_startup

    run_application_startup()
