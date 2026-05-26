from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile, Query, Request, Path, Response
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse, HTMLResponse
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr
import base64
import os
import logging
import json
import uuid
import asyncio
import time
import secrets
import string
from datetime import datetime
import httpx
from starlette.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from app.smtp_client import send_email
from app.auth import (
    get_current_user, is_admin, is_expert_or_admin, get_user_info_from_token_sync
)
from app.ontology import (
    add_asana_name, add_source, load_asana_names, load_asanas, add_asana, load_sources,
    delete_source_from_ontology, update_source_in_ontology, delete_asana_name_from_ontology, delete_asana_from_ontology,
    add_photo_to_asana, get_asanas_by_first_letter, get_asanas_by_source, search_asanas_by_name,
    search_sources,
    get_photo_of_asana_from_source, get_similar_asanas, add_same_as_object, remove_same_as_object,
    update_asana_name,
    collect_photo_hash_dedup_pairs_for_source,
    rotate_photo_in_asana,
    migrate_staging_s3_photo_paths_in_ontology,
)
from app.moderation_photo import (
    enrich_moderation_import_data,
    image_bytes_from_import_dict,
    parse_moderation_item_import,
)
from app.config import logger, NAME_BUCKET_IMAGES_MINIO, S3_IMPORT_STAGING_PREFIX
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from app.models import Base, AboutProject, ExpertInstructions, UserRole, User, ModerationItem, AISimilarityProposal, AuditEvent
from sqlalchemy import create_engine, func, asc, desc
from sqlalchemy.orm import sessionmaker
from app import config
from fastapi.templating import Jinja2Templates
from jose import jwt, JWTError
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

# Create module logger
logger = logging.getLogger("asana_service.api")

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["service", "method", "path", "status"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["service", "method", "path"],
)
CATALOG_ENTITIES_TOTAL = Gauge(
    "catalog_entities_total",
    "Catalog entities in mirror",
    ["entity_type"],
)
MODERATION_PENDING_TOTAL = Gauge(
    "moderation_pending_total",
    "Pending moderation rows",
    ["kind"],
)
CATALOG_VISITORS_TOTAL = Gauge(
    "catalog_visitors_total",
    "Total unique authenticated users who visited the catalog",
)
CATALOG_USERS_ONLINE = Gauge(
    "catalog_users_online",
    "Authenticated users active within the online window",
)

# Определение моделей для данных, используемых в API
class AsanaNameCreate(BaseModel):
    name_ru: str
    name_sanskrit: Optional[str] = None
    transliteration: Optional[str] = None
    definition: Optional[str] = None

class SourceCreate(BaseModel):
    title: str
    author: str
    year: int
    publisher: Optional[str] = None
    pages: Optional[int] = None
    annotation: Optional[str] = None

class AsanaCreate(BaseModel):
    selected_name: Optional[str] = None
    new_name: Optional[AsanaNameCreate] = None
    selected_source: Optional[str] = None
    new_source: Optional[SourceCreate] = None
    photo_base64: str

class TextContent(BaseModel):
    content: str

class UserRoleUpdate(BaseModel):
    username: str
    new_role: UserRole

app = FastAPI(
    title=config.APP_NAME,
    description=config.APP_DESCRIPTION,
    version=config.APP_VERSION,
    contact={"email": config.APP_CONTACT_EMAIL},
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json"
)

# Middleware для защиты документации API
class DocsAuthMiddleware(BaseHTTPMiddleware):
    """Middleware для защиты документации API - только для администратора."""

    @staticmethod
    def _extract_token_from_referer(referer: str | None) -> str | None:
        if not referer:
            return None
        try:
            from urllib.parse import parse_qs, urlparse

            parsed = urlparse(referer)
            query = parse_qs(parsed.query or "")
            token_values = query.get("access_token") or query.get("token")
            if token_values and token_values[0]:
                return token_values[0]
        except Exception:
            return None
        return None
    
    @staticmethod
    def _wants_html(request: StarletteRequest) -> bool:
        accept = (request.headers.get("accept") or "").lower()
        return "text/html" in accept or "*/*" in accept and "application/json" not in accept

    @staticmethod
    def _docs_login_redirect(request: StarletteRequest) -> RedirectResponse:
        from urllib.parse import quote

        nxt = quote(request.url.path, safe="")
        return RedirectResponse(url=f"/login?next={nxt}", status_code=302)

    @staticmethod
    def _docs_forbidden_redirect() -> RedirectResponse:
        return RedirectResponse(url="/admin?forbidden=docs", status_code=302)

    async def dispatch(self, request: StarletteRequest, call_next):
        # Проверяем, является ли запрос к документации
        path = request.url.path
        
        # Защищаем основные пути документации
        # Также защищаем статические файлы Swagger UI (они загружаются через /docs/static/...)
        protected_paths = ["/api/docs", "/api/redoc", "/api/openapi.json"]
        is_protected = any(path == protected or path.startswith(protected + "/") for protected in protected_paths)
        
        if is_protected:
            # Получаем токен из заголовков или cookies
            token = (
                request.headers.get("Authorization", "").replace("Bearer ", "")
                or request.cookies.get("access_token")
                or request.cookies.get("session_token")
                or request.query_params.get("access_token")
                or self._extract_token_from_referer(request.headers.get("referer"))
            )
            
            if not token:
                if self._wants_html(request):
                    return self._docs_login_redirect(request)
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Требуется авторизация для доступа к документации API"},
                )
            
            # Проверяем авторизацию и роль пользователя
            try:
                user_data = get_user_info_from_token_sync(token)
                if not user_data:
                    if self._wants_html(request):
                        return self._docs_login_redirect(request)
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Недействительный токен авторизации"},
                    )
                
                # Проверяем, что пользователь является администратором
                is_admin_flag = user_data.get("is_admin", False)
                if not is_admin_flag:
                    if self._wants_html(request):
                        return self._docs_forbidden_redirect()
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Доступ к документации API разрешен только администраторам"},
                    )
                
                # Пользователь авторизован и имеет нужные права - пропускаем запрос
            except Exception as e:
                logger.error(f"Error checking auth in docs middleware: {str(e)}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Ошибка проверки авторизации"}
                )
        
        # Продолжаем обработку запроса
        response = await call_next(request)
        return response


def _extract_docs_token(request: Request) -> str | None:
    return (
        request.headers.get("Authorization", "").replace("Bearer ", "")
        or request.cookies.get("access_token")
        or request.cookies.get("session_token")
        or request.query_params.get("access_token")
    )


@app.get("/api/docs", include_in_schema=False)
async def custom_swagger_docs(request: Request):
    from urllib.parse import quote

    token = _extract_docs_token(request)
    openapi_url = "/api/openapi.json"
    if token:
        openapi_url = f"/api/openapi.json?access_token={quote(token, safe='')}"
    return get_swagger_ui_html(openapi_url=openapi_url, title=f"{config.APP_NAME} - Swagger UI")


@app.get("/api/redoc", include_in_schema=False)
async def custom_redoc_docs(request: Request):
    from urllib.parse import quote

    token = _extract_docs_token(request)
    openapi_url = "/api/openapi.json"
    if token:
        openapi_url = f"/api/openapi.json?access_token={quote(token, safe='')}"
    return get_redoc_html(openapi_url=openapi_url, title=f"{config.APP_NAME} - ReDoc")


def _extract_monitoring_token(request: Request) -> str | None:
    return (
        request.headers.get("Authorization", "").replace("Bearer ", "")
        or request.headers.get("X-Access-Token", "")
        or request.cookies.get("monitoring_token")
        or request.query_params.get("access_token")
    )


def _require_admin_from_token(token: str) -> dict:
    user_data = get_user_info_from_token_sync(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    if not user_data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Доступ только для администратора")
    return user_data


@app.api_route("/api/auth/verify-admin", methods=["GET", "HEAD"], include_in_schema=False)
async def verify_admin_monitoring(request: Request):
    """Проверка прав админа для nginx auth_request (Grafana/Kibana)."""
    token = _extract_monitoring_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    _require_admin_from_token(token)
    return Response(status_code=200)


@app.get("/api/auth/monitoring-session", include_in_schema=False)
async def monitoring_session(
    request: Request,
    access_token: str = Query(..., description="JWT администратора"),
    next: str = Query("/grafana/"),
):
    """Выдаёт cookie для доступа к Grafana/Kibana только администратору."""
    _require_admin_from_token(access_token)
    if not (next.startswith("/grafana") or next.startswith("/kibana")):
        raise HTTPException(status_code=400, detail="Недопустимый redirect")
    response = RedirectResponse(url=next, status_code=302)
    secure = request.url.scheme == "https"
    response.set_cookie(
        key="monitoring_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=8 * 3600,
        path="/",
    )
    return response


def _clear_auth_cookies(response: Response, *, secure: bool) -> None:
    for key in ("monitoring_token", "access_token", "session_token"):
        response.delete_cookie(key=key, path="/", secure=secure, samesite="lax")


@app.api_route("/api/auth/logout", methods=["GET", "POST"], include_in_schema=False)
async def logout_session(request: Request):
    """Сброс cookie мониторинга и Swagger (localStorage чистит фронтенд)."""
    response = JSONResponse({"ok": True})
    _clear_auth_cookies(response, secure=request.url.scheme == "https")
    return response


@app.get("/api/auth/access-denied", include_in_schema=False)
async def access_denied_page(code: int = Query(403, ge=401, le=403)):
    """Страница «нет доступа» для nginx auth_request (UTF-8)."""
    if code == 401:
        body = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Требуется вход</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:36rem">
<h1>Требуется вход</h1>
<p>Grafana и Kibana доступны только администратору после входа в каталог.</p>
<p><a href="/login">Перейти на страницу входа</a></p>
</body></html>"""
    else:
        body = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Доступ запрещён</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:36rem">
<h1>Доступ запрещён</h1>
<p>Grafana и Kibana доступны только администратору. Войдите под учётной записью администратора
и откройте ссылку из раздела «Администрирование».</p>
<p><a href="/login">Войти</a> · <a href="/asanas">На главную</a></p>
</body></html>"""
    return HTMLResponse(content=body, status_code=code, media_type="text/html; charset=utf-8")


class AuditMiddleware(BaseHTTPMiddleware):
    """Записывает аудит mutating API-запросов для админ-панели."""

    _skip_prefixes = ("/api/docs", "/api/redoc", "/api/openapi.json", "/health", "/metrics")
    _skip_exact = ("/api/auth/check", "/api/auth/logout")
    _track_methods = {"POST", "PATCH", "PUT", "DELETE"}

    async def dispatch(self, request: StarletteRequest, call_next):
        from app.audit_context import (
            build_audit_payload,
            parse_request_body,
            prefetch_entity_context,
            should_record_audit,
        )

        path = request.url.path
        method = request.method.upper()
        should_track = (
            method in self._track_methods
            and not any(path.startswith(prefix) for prefix in self._skip_prefixes)
            and path not in self._skip_exact
        )
        start = datetime.utcnow()
        query_params = dict(request.query_params)
        body_raw = b""
        prefetched: dict = {}

        if should_track:
            body_raw = await request.body()

            async def receive():
                return {"type": "http.request", "body": body_raw, "more_body": False}

            request._receive = receive
            prefetched = prefetch_entity_context(method, path, query_params)

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

        login = user_data.get("login")
        avatar_url = user_data.get("avatar_url")

        body_data = parse_request_body(body_raw, request.headers.get("content-type"))
        duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        audit = build_audit_payload(
            method=method,
            path=path,
            query_params=query_params,
            body=body_data,
            status_code=int(response.status_code),
            duration_ms=duration_ms,
            prefetched=prefetched,
        )
        if user_data.get("is_admin"):
            audit["details"]["actor_role"] = "admin"
        elif user_data.get("permission_study"):
            audit["details"]["actor_role"] = "expert"

        db = SessionLocal()
        try:
            event = AuditEvent(
                timestamp=datetime.utcnow().isoformat(),
                login=login,
                avatar_url=avatar_url,
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
            logger.warning("Failed to write audit event: %s", exc)
        finally:
            db.close()
        return response


class UserActivityMiddleware(BaseHTTPMiddleware):
    """Учёт уникальных посетителей и онлайн-пользователей (Redis → Prometheus)."""

    _skip_prefixes = (
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/health",
        "/metrics",
        "/api/auth/verify-admin",
        "/api/auth/monitoring-session",
    )

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        if response.status_code >= 400:
            return response
        path = request.url.path
        if any(path.startswith(prefix) for prefix in self._skip_prefixes):
            return response
        token = (
            request.headers.get("Authorization", "").replace("Bearer ", "")
            or request.cookies.get("access_token")
            or request.cookies.get("session_token")
            or request.query_params.get("access_token")
        )
        if not token:
            return response
        try:
            from app.user_activity import record_user_activity

            user_data = get_user_info_from_token_sync(token)
            if user_data and user_data.get("login"):
                record_user_activity(user_data.get("login"))
        except Exception as exc:
            logger.debug("User activity tracking skipped: %s", exc)
        return response


# Добавляем middleware для защиты документации (перед CORS)
app.add_middleware(DocsAuthMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(UserActivityMiddleware)

# Разрешаем CORS для всех источников (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def prometheus_metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    path = request.url.path
    method = request.method
    HTTP_REQUESTS_TOTAL.labels("asana-backend", method, path, str(response.status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels("asana-backend", method, path).observe(elapsed)
    return response


@app.get("/metrics", include_in_schema=False)
async def metrics():
    if SessionLocal is not None:
        db = SessionLocal()
        try:
            from app.models import CatalogMirrorItem
            for entity_type, count in db.query(CatalogMirrorItem.entity_type, func.count()).group_by(CatalogMirrorItem.entity_type).all():
                CATALOG_ENTITIES_TOTAL.labels((entity_type or "unknown").lower()).set(int(count))

            MODERATION_PENDING_TOTAL.labels("manual").set(
                int(db.query(func.count(ModerationItem.id)).filter(ModerationItem.resolved == False).scalar() or 0)
            )
            MODERATION_PENDING_TOTAL.labels("ai").set(
                int(db.query(func.count(AISimilarityProposal.id)).filter(AISimilarityProposal.status == "pending").scalar() or 0)
            )
        except Exception as exc:
            logger.warning("Failed to refresh domain gauges: %s", exc)
        finally:
            db.close()
    try:
        from app.user_activity import get_activity_metrics

        visitors, online = get_activity_metrics()
        CATALOG_VISITORS_TOTAL.set(visitors)
        CATALOG_USERS_ONLINE.set(online)
    except Exception as exc:
        logger.warning("Failed to refresh user activity gauges: %s", exc)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Обработчик ошибок валидации
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации с детальным логированием"""
    errors = exc.errors()
    logger.error(f"Validation error on {request.url.path}")
    logger.error(f"Validation errors: {json.dumps(errors, indent=2, ensure_ascii=False)}")
    logger.error(f"Request method: {request.method}, URL: {request.url}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": errors,
            "message": "Ошибка валидации данных формы"
        }
    )

engine = None
SessionLocal = None

# Один lock на все процессы (backend + import, несколько реплик): без него create_all гоняется и ловит
# duplicate key на pg_type (catalog_sync_state, …) при одновременном старте контейнеров.
_DICT_DB_INIT_ADVISORY_LOCK_ID = 584920171


def init_database():
    """Инициализация базы данных"""
    global engine, SessionLocal
    
    if engine is None:
        engine = create_engine(config.SQLALCHEMY_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        from sqlalchemy import text
        from app.models import (
            AboutProject,
            AuditEvent,
            AISimilarityProposal,
            CatalogMirrorItem,
            CatalogSyncState,
            ExpertInstructions,
            ImportBatch,
            ImportStagingRow,
            ModerationItem,
            User,
        )
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("SELECT pg_advisory_lock(:id)"),
                    {"id": _DICT_DB_INIT_ADVISORY_LOCK_ID},
                )
                try:
                    conn.execute(text("CREATE SCHEMA IF NOT EXISTS dict_schema"))
                    conn.execute(text("ALTER TABLE IF EXISTS dict_schema.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)"))
                    conn.execute(text("ALTER TABLE IF EXISTS dict_schema.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE"))
                    Base.metadata.create_all(
                        bind=conn,
                        tables=[
                            User.__table__,
                            AboutProject.__table__,
                            ExpertInstructions.__table__,
                            AuditEvent.__table__,
                            ModerationItem.__table__,
                            CatalogSyncState.__table__,
                            CatalogMirrorItem.__table__,
                            ImportBatch.__table__,
                            ImportStagingRow.__table__,
                            AISimilarityProposal.__table__,
                        ],
                    )
                finally:
                    conn.execute(
                        text("SELECT pg_advisory_unlock(:id)"),
                        {"id": _DICT_DB_INIT_ADVISORY_LOCK_ID},
                    )
        except Exception as e:
            logger.error(f"Failed to create schema/tables: {e}")
            raise

# Создаем записи о проекте и инструкции, если их нет
def _load_seed_markdown(filename: str, fallback: str) -> str:
    """
    Ищет MD-сидер по нескольким путям-кандидатам:
    - /app/seed_content/<filename> (volume в docker-compose);
    - ../<original_name> относительно backend/ (локальный запуск без docker).
    Если ничего не нашли — возвращает короткий fallback.
    """
    candidate_paths = [
        os.path.join("/app/seed_content", filename),
        os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..", filename
        ),
    ]
    for path in candidate_paths:
        try:
            if os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                if content:
                    logger.info("Loaded seed content from %s", path)
                    return content
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to read seed content %s: %s", path, e)
    return fallback


def create_default_content():
    """Создание контента по умолчанию (только если запись отсутствует)."""
    db = SessionLocal()
    try:
        if not db.query(AboutProject).first():
            content = _load_seed_markdown(
                "about_project.md", fallback="О проекте каталога асан"
            )
            db.add(AboutProject(content=content))
            logger.info("Created default about project content")

        if not db.query(ExpertInstructions).first():
            content = _load_seed_markdown(
                "expert_instructions.md", fallback="Инструкция для экспертов"
            )
            db.add(ExpertInstructions(content=content))
            logger.info("Created default expert instructions")

        db.commit()
    finally:
        db.close()

def add_moderation_columns_if_needed():
    """Добавляет новые колонки в таблицу moderation_items, если их нет"""
    from sqlalchemy import text, inspect
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('moderation_items', schema='dict_schema')]
        
        new_columns = {
            'suggested_name_ru': 'VARCHAR(500)',
            'suggested_name_sanskrit': 'VARCHAR(500)',
            'suggested_transliteration': 'VARCHAR(500)',
            'suggested_definition': 'TEXT',
            'existing_name_id': 'VARCHAR(500)',
            'existing_name_ru': 'VARCHAR(500)',
            'moderation_type': 'VARCHAR(50)',
            'object_type': 'VARCHAR(50)'
        }
        
        for col_name, col_type in new_columns.items():
            if col_name not in columns:
                logger.info(f"Adding column {col_name} to moderation_items table")
                db.execute(text(f"ALTER TABLE dict_schema.moderation_items ADD COLUMN {col_name} {col_type}"))
                db.commit()
                logger.info(f"Successfully added column {col_name}")
        
        db.close()
    except Exception as e:
        logger.error(f"Error adding moderation columns: {e}")
        db.rollback()
        db.close()
        raise

def run_application_startup() -> None:
    """Инициализация БД и окружения (общая для основного API и сервиса import/export)."""
    init_database()
    add_moderation_columns_if_needed()
    create_default_content()
    create_default_users()

    try:
        from app.s3_utils import setup_minio_bucket_policy

        setup_minio_bucket_policy()
    except Exception as e:
        logger.warning(
            "Failed to setup MinIO bucket policy: %s. This is not critical, but images may not be accessible.",
            e,
        )

    # Удаление «битых» асан без ни одного фото (после сбойного импорта). Только там, где включено
    # (у asana-import в compose выставляют OWL_PURGE_EMPTY_ASANAS_ON_START=false — один писатель OWL).
    if os.getenv("OWL_PURGE_EMPTY_ASANAS_ON_START", "true").lower() in ("1", "true", "yes"):
        db_owl = SessionLocal()
        lease_acquired = False
        removed_empty = 0
        try:
            from app.catalog_sync import acquire_owl_write_lease, release_owl_write_lease
            from app.ontology import purge_asanas_without_photos_from_ontology

            acquire_owl_write_lease(db_owl)
            lease_acquired = True
            removed_empty = purge_asanas_without_photos_from_ontology()
            if removed_empty:
                logger.info(
                    "Стартовая очистка OWL: удалено асан без фото: %s",
                    removed_empty,
                )
        except Exception as purge_err:
            logger.warning(
                "Стартовая очистка асан без фото пропущена из-за ошибки: %s",
                purge_err,
                exc_info=True,
            )
        finally:
            if lease_acquired:
                try:
                    release_owl_write_lease(db_owl)
                except Exception as rel_err:
                    logger.warning("release_owl_write_lease после очистки: %s", rel_err)
            db_owl.close()
        if removed_empty:
            try:
                from app.catalog_sync import run_sync_with_new_session

                run_sync_with_new_session()
            except Exception as sync_err:
                logger.warning("Синхронизация зеркала после очистки асан без фото: %s", sync_err)

    # Перенос s3PhotoPath из import-staging в images/asans/ при старте (только asana-backend;
    # у asana-import в compose OWL_MIGRATE_STAGING_PHOTOS_ON_START=false).
    if os.getenv("OWL_MIGRATE_STAGING_PHOTOS_ON_START", "true").lower() in ("1", "true", "yes"):
        db_mig = SessionLocal()
        lease_mig = False
        try:
            from app.catalog_sync import acquire_owl_write_lease, release_owl_write_lease

            acquire_owl_write_lease(db_mig)
            lease_mig = True
            stats = migrate_staging_s3_photo_paths_in_ontology()
            promoted = int(stats.get("promoted_and_rewritten", 0) or 0)
            orphan = int(stats.get("staging_paths_file_missing_in_s3", 0) or 0)
            if promoted or orphan:
                logger.info(
                    "Стартовая миграция staging→asans: переписано путей=%s, staging в OWL без файла в S3=%s",
                    promoted,
                    orphan,
                )
            if promoted:
                try:
                    from app.catalog_sync import run_sync_with_new_session

                    run_sync_with_new_session()
                except Exception as sync_err:
                    logger.warning("Синхронизация зеркала после миграции staging: %s", sync_err)
        except Exception as mig_err:
            logger.warning(
                "Стартовая миграция staging→asans пропущена из-за ошибки: %s",
                mig_err,
                exc_info=True,
            )
        finally:
            if lease_mig:
                try:
                    release_owl_write_lease(db_mig)
                except Exception as rel_err:
                    logger.warning("release_owl_write_lease после миграции staging: %s", rel_err)
            db_mig.close()

    try:
        from app.audit_context import maintain_audit_log

        db_audit = SessionLocal()
        try:
            expired, garbage = maintain_audit_log(db_audit)
            if expired or garbage:
                logger.info("Аудит: удалено устаревших=%s, мусорных=%s", expired, garbage)
        finally:
            db_audit.close()
    except Exception as audit_maint_err:
        logger.warning("Очистка журнала аудита пропущена: %s", audit_maint_err)

    logger.info("Application startup completed successfully")

    db = SessionLocal()
    try:
        from app.catalog_sync import ensure_catalog_sync_state_row, start_catalog_sync_background_thread

        ensure_catalog_sync_state_row(db)
        start_catalog_sync_background_thread()
    except Exception as e:
        logger.warning("Catalog sync init: %s", e)
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    try:
        run_application_startup()
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise

# Создаем стандартных пользователей, если их нет
def create_default_users():
    """Создание стандартных пользователей для авторизации через server-module"""
    from passlib.context import CryptContext
    import os
    
    # Используем ту же конфигурацию и метод, что и в server-module
    # Это гарантирует 100% совместимость со старыми паролями
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()
    
    def hash_password(password: str) -> str:
        """Хеширует пароль с использованием passlib, как в server-module"""
        # Используем passlib.hash() для полной совместимости со старыми паролями
        # Старые пароли создавались через passlib, новые должны быть в том же формате
        return pwd_context.hash(password)
    
    # Создаем стандартных пользователей ТОЛЬКО если их нет
    # НЕ трогаем существующих пользователей, чтобы сохранить их старые пароли
    admin_login = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if not db.query(User).filter(User.login == admin_login).first():
        admin_user = User(
            login=admin_login,
            mail=f"{admin_login}@example.com",
            password=hash_password(admin_password),
            is_admin=True,
            permission_study=True,
            is_verify=True
        )
        db.add(admin_user)
        logger.info(f"Created default admin user: {admin_login}")
    
    # Создаем expert пользователя
    expert_login = os.getenv("EXPERT_USERNAME", "expert")
    expert_password = os.getenv("EXPERT_PASSWORD", "expert123")
    
    if not db.query(User).filter(User.login == expert_login).first():
        expert_user = User(
            login=expert_login,
            mail=f"{expert_login}@example.com",
            password=hash_password(expert_password),
            is_admin=False,
            permission_study=True,
            is_verify=True
        )
        db.add(expert_user)
        logger.info(f"Created default expert user: {expert_login}")
    
    db.commit()
    db.close()

# Инициализация выполняется в startup event

# Маршруты аутентификации и авторизации
# Авторизация и регистрация теперь обрабатываются внешним сервисом
# Токены приходят извне и проверяются через get_user_role_from_request

# Логаут теперь обрабатывается фронтендом
# @app.get("/logout")

# Маршруты для асан
@app.get("/api/asanas", tags=["asana"])
async def get_asanas():
    """Получить все асаны (доступно всем)"""
    logger.info("Getting asanas list for all users")
    asanas = load_asanas()
    logger.info(f"Retrieved {len(asanas)} asanas")
    return asanas

@app.get("/api/asana/{asana_id}", tags=["asana"])
async def get_asana_by_id_endpoint(asana_id: str = Path(...)):
    """Получить асану по ID (доступно всем)"""
    logger.info(f"Getting asana by ID: {asana_id}")
    
    # Убираем суффикс -page, если он есть
    if asana_id.endswith('-page'):
        asana_id = asana_id[:-5]
    
    asana = get_asana_by_id(asana_id)
    
    if not asana:
        logger.warning(f"Asana not found with ID: {asana_id}")
        raise HTTPException(status_code=404, detail="Асана не найдена")
    
    logger.info(f"Found asana: {asana.get('name', {}).get('name_ru', 'Unknown')}")
    return asana

@app.get("/api/asanas/by-letter/{letter}", tags=["asana"])
async def get_asanas_by_letter(letter: str):
    """Получить асаны, начинающиеся с определенной буквы (доступно всем)"""
    logger.info(f"Getting asanas starting with letter: {letter}")
    asanas = get_asanas_by_first_letter(letter)
    return asanas

@app.get("/api/asanas/by-source/{source_id}", tags=["asana"])
async def get_source_asanas(source_id: str):
    """Получить асаны из определенного источника (доступно всем)"""
    logger.info(f"Getting asanas from source: {source_id}")
    asanas = get_asanas_by_source(source_id)
    return asanas

@app.get("/api/asanas/search", tags=["asana"])
async def search_asanas(query: str, fuzzy: bool = True):
    """Поиск асан по названию (доступно всем). Совпадение только целых слов; fuzzy в запросе игнорируется."""
    logger.info(f"Searching asanas with query: {query} (whole-word)")
    asanas = search_asanas_by_name(query)
    logger.info(f"Found {len(asanas)} asanas matching query: {query}")
    return asanas

@app.get("/asana/add", tags=["asana"])
def add_asana_page(request: Request):
    """Страница добавления асаны (только для expert/admin)"""
    user_role = get_user_role_from_request(request)
    if user_role not in ['admin', 'expert']:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Загружаем существующие названия и источники для выбора
    names = load_asana_names()
    sources = load_sources()
    
    return templates.TemplateResponse(
        "add_asana.html",
        {
            "request": request,
            "names": names,
            "sources": sources,
            "user_role": user_role,
            "is_admin": user_role == 'admin',
            "is_authenticated": True,
            "is_expert_or_admin": True,
            "year": datetime.now().year
        }
    )

@app.post("/api/asana", tags=["asana"])
async def post_asana(
    selected_name: str = Form(...),
    new_name_ru: Optional[str] = Form(None),
    new_name_sanskrit: Optional[str] = Form(None),
    transliteration: Optional[str] = Form(None),
    definition: Optional[str] = Form(None),
    selected_source: str = Form(...),
    new_source_title: Optional[str] = Form(None),
    new_source_author: Optional[str] = Form(None),
    new_source_year: Optional[str] = Form(None),  # Изменено на str для обработки пустых строк
    new_source_publisher: Optional[str] = Form(None),
    new_source_pages: Optional[str] = Form(None),  # Изменено на str для обработки пустых строк
    new_source_annotation: Optional[str] = Form(None),
    photos: Optional[List[UploadFile]] = File(None),
    user: str = Depends(is_expert_or_admin)
):
    """Добавить новую асану (только эксперты и админы)"""
    try:
        if not photos:
            photos = []
        logger.info(f"Adding new asana by user: {user}")
        logger.debug(f"Form data received - selected_name: {selected_name}, selected_source: {selected_source}")
        logger.debug(f"New name data: ru={new_name_ru}, sanskrit={new_name_sanskrit}")
        logger.debug(f"New source data: title={new_source_title}, author={new_source_author}, year={new_source_year}")
        logger.debug(f"Photos count: {len(photos)}")
        
        # Обработка названия
        name_id = None
        if selected_name != "new":
            logger.debug(f"Using existing name ID: {selected_name}")
            name_id = selected_name
        elif new_name_ru:
            logger.info("Creating new asana name")
            name_data = {
                "name_ru": new_name_ru
            }
            if new_name_sanskrit:
                name_data["name_sanskrit"] = new_name_sanskrit
            if transliteration:
                name_data["transliteration"] = transliteration
            if definition:
                name_data["definition"] = definition
            name_id = add_asana_name(name_data)
            logger.debug(f"Created new name with ID: {name_id}")
        else:
            logger.error("Missing required name fields for new name")
            raise HTTPException(status_code=400, detail="При добавлении нового названия поле названия на русском обязательно")

        # Обработка источника
        source_id = None
        if selected_source != "new":
            logger.debug(f"Using existing source ID: {selected_source}")
            source_id = selected_source
        elif all([new_source_title, new_source_author, new_source_year]):
            logger.info("Creating new source")
            
            # Преобразуем year в int, обрабатывая пустые строки
            try:
                year = int(new_source_year) if new_source_year and new_source_year.strip() else 0
            except (ValueError, TypeError):
                year = 0
            
            source_data = {
                "title": new_source_title,
                "author": new_source_author,
                "year": year
            }
            
            # Добавляем необязательные поля, если они есть
            if new_source_publisher:
                source_data["publisher"] = new_source_publisher
            if new_source_pages and new_source_pages.strip():
                try:
                    source_data["pages"] = int(new_source_pages)
                except (ValueError, TypeError):
                    pass  # Пропускаем если не удалось преобразовать
            if new_source_annotation:
                source_data["annotation"] = new_source_annotation
                
            source_id = add_source(source_data)
            logger.debug(f"Created new source with ID: {source_id}")
        else:
            logger.error("Missing required source fields for new source")
            raise HTTPException(status_code=400, detail="При добавлении нового источника поля автора, названия и года обязательны")

        # Проверяем, существует ли уже асана с таким названием и источником
        from app.ontology import find_existing_asana, get_graph, ASANA, norm_image_hash_hex
        from rdflib import URIRef
        existing_asana_id = find_existing_asana(name_id, source_id)
        
        # Если асана уже существует, получаем пары (MD5, dedup) ДО загрузки фото в S3
        existing_photo_pairs: List[tuple] = []
        if existing_asana_id:
            g = get_graph()
            asana_uri = URIRef(existing_asana_id)
            source_uri = URIRef(source_id)
            existing_photo_pairs = collect_photo_hash_dedup_pairs_for_source(g, asana_uri, source_uri)
        
        # Обработка фото - вычисляем хеши ДО загрузки в S3, загружаем только новые
        photo_s3_paths = []
        photo_hashes = []
        photo_dedup_fps: List[Optional[str]] = []
        all_photos_were_duplicates = False
        if photos:
            logger.info(f"[DEBUG MAIN] Processing {len(photos)} photo(s)")
            from app.s3_utils import upload_image_to_s3, compute_image_hash
            from app.photo_dedup import compute_photo_dedup_fingerprint, photo_matches_any_existing, norm_dedup_fp

            processed_pairs: List[tuple] = []  # (md5_norm, dedup_norm) каждого входящего фото
            for idx, photo in enumerate(photos):
                try:
                    photo_content = await photo.read()
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: read {len(photo_content)} bytes")
                    
                    # Вычисляем хеш ДО загрузки в S3
                    photo_hash = compute_image_hash(photo_content)
                    photo_dedup = compute_photo_dedup_fingerprint(photo_content)
                    ph_n = norm_image_hash_hex(photo_hash)
                    dd_n = norm_dedup_fp(photo_dedup)
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: computed hash={photo_hash}")
                    processed_pairs.append((ph_n, dd_n))
                    
                    # Проверяем, не является ли это дубликатом (учёт поворота 0/90/180/270)
                    if existing_asana_id and photo_matches_any_existing(ph_n, dd_n, existing_photo_pairs):
                        logger.info(f"[INFO MAIN] Photo {idx+1} is duplicate (dedup/MD5), skipping upload to S3")
                        continue  # Пропускаем загрузку дубликата
                    
                    # Загружаем в S3 только если фото новое
                    photo_s3_path, _ = upload_image_to_s3(photo_content, prefix="asans")
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: uploaded to S3, path={photo_s3_path}, hash={photo_hash}")
                    photo_s3_paths.append(photo_s3_path)
                    photo_hashes.append(photo_hash)
                    photo_dedup_fps.append(photo_dedup if photo_dedup else None)
                    logger.info(f"[DEBUG MAIN] Photo {idx+1} added to list. Total paths: {len(photo_s3_paths)}")
                except Exception as e:
                    logger.error(f"[ERROR MAIN] Error processing photo {idx+1}: {e}", exc_info=True)
                    # НЕ сохраняем base64! Пропускаем фото при ошибке
                    logger.warning(f"[WARNING MAIN] Skipping photo {idx+1} due to error - will add asana without this photo")
            
            # Проверяем, все ли фото были дубликатами
            if existing_asana_id and processed_pairs and all(
                photo_matches_any_existing(a, b, existing_photo_pairs) for a, b in processed_pairs
            ):
                all_photos_were_duplicates = True
        else:
            logger.info(f"[DEBUG MAIN] No photos provided in request")

        # Если асана уже существует, проверяем результат
        if existing_asana_id:
            # Проверяем, есть ли новые фото для добавления
            if photo_hashes:
                # Есть новые фото, добавляем их к существующей асане
                logger.info(f"[INFO MAIN] Adding {len(photo_hashes)} new photo(s) to existing asana")
                asana_id = add_asana(
                    name_id=name_id,
                    source_id=source_id,
                    photo_paths=photo_s3_paths,
                    photo_hashes=photo_hashes,
                    photo_dedup_fingerprints=photo_dedup_fps,
                )
                return {"message": f"Added {len(photo_hashes)} new photo(s) to existing asana", "id": asana_id, "added_photos": len(photo_hashes)}
            else:
                # Все фото были дубликатами или фото нет в запросе
                if all_photos_were_duplicates:
                    # Были фото, но все дубликаты
                    logger.info(f"[INFO MAIN] All photos are duplicates, skipping")
                    return {"message": "Asana already exists with identical photos", "id": existing_asana_id, "skipped": True}
                else:
                    # Фото нет в запросе
                    logger.info(f"[INFO MAIN] Asana already exists, no new photos provided, skipping")
                    return {"message": "Asana already exists (identical record)", "id": existing_asana_id, "skipped": True}

        # Асана не существует, создаем новую (источник в модели только у фото — без фото асану не создаём)
        if not photo_s3_paths:
            raise HTTPException(
                status_code=400,
                detail="Загрузите хотя бы одно фото: источник задаётся в связке с изображением.",
            )
        logger.info(f"[DEBUG MAIN] Adding asana to ontology with {len(photo_s3_paths)} photo path(s)")
        logger.info(f"[DEBUG MAIN] Photo paths to add: {photo_s3_paths}")
        asana_id = add_asana(
            name_id=name_id,
            source_id=source_id,
            photo_paths=photo_s3_paths,
            photo_hashes=photo_hashes,
            photo_dedup_fingerprints=photo_dedup_fps,
        )
        logger.info(f"[DEBUG MAIN] Successfully created asana with ID: {asana_id} with {len(photo_s3_paths)} photo(s)")
        
        return {"message": "Asana added successfully", "id": asana_id}
    except Exception as e:
        logger.error(f"Error adding asana: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/asanas")
async def delete_asana(user: str = Depends(is_expert_or_admin), uri: str = Query(...)):
    """Удалить асану (только эксперты и админы)"""
    try:
        logger.info(f"Deleting asana with URI: {uri} by user: {user}")
        success = delete_asana_from_ontology(uri)
        if not success:
            logger.warning(f"Asana not found: {uri}")
            raise HTTPException(status_code=404, detail="Asana not found")
        logger.info(f"Successfully deleted asana: {uri}")
        return {"message": "Asana deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting asana: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/asana/{asana_id}/add-photo")
async def add_asana_photo_endpoint(
    asana_id: str, 
    source_id: str = Form(...),
    photo: UploadFile = File(...),  # Изменено на единственное число для совместимости с frontend
    user: str = Depends(is_expert_or_admin)
):
    """Добавить фото к асане (только эксперты и админы)"""
    try:
        photo_bytes = await photo.read()
        photo_uri = add_photo_to_asana(asana_id, photo_bytes, source_id)
        return {"message": "Фото добавлено", "photo_id": photo_uri}
    except Exception as e:
        logger.error(f"Error adding photo to asana: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/asana/{asana_id}/photo/{photo_id}")
async def replace_asana_photo_endpoint(
    asana_id: str,
    photo_id: str,
    photo: UploadFile = File(...),
    user: str = Depends(is_expert_or_admin)
):
    """Заменить фото асаны (только эксперты и админы)"""
    try:
        # Формируем полные URI
        if not asana_id.startswith('http://'):
            if not asana_id.startswith('asana_'):
                asana_id = f"asana_{asana_id}"
            asana_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"
        
        if not photo_id.startswith('http://'):
            if not photo_id.startswith('photo_'):
                photo_id = f"photo_{photo_id}"
            photo_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{photo_id}"
        
        photo_bytes = await photo.read()
        from app.ontology import replace_photo_in_asana
        success = replace_photo_in_asana(asana_id, photo_id, photo_bytes)
        
        if not success:
            raise HTTPException(status_code=404, detail="Photo not found or does not belong to this asana")
        
        return {"message": "Фото успешно заменено"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replacing photo: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/asana/{asana_id}/photo/{photo_id}/rotate")
async def rotate_asana_photo_endpoint(
    asana_id: str,
    photo_id: str,
    degrees: int = Query(90, description="Угол по часовой стрелке: 90, 180 или 270"),
    user: str = Depends(is_expert_or_admin),
):
    """
    Поворот фото на 90°, 180° или 270° по часовой стрелке с перезаписью того же объекта в S3 (UUID в пути не меняется).
    Угол передаётся query-параметром ?degrees= (раньше был FormData — с axios + JSON default ломалось).
    """
    if degrees not in (90, 180, 270):
        raise HTTPException(status_code=400, detail="degrees must be 90, 180 or 270")
    try:
        if not asana_id.startswith("http://"):
            if not asana_id.startswith("asana_"):
                asana_id = f"asana_{asana_id}"
            asana_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"

        if not photo_id.startswith("http://"):
            if not photo_id.startswith("photo_"):
                photo_id = f"photo_{photo_id}"
            photo_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{photo_id}"

        ok = rotate_photo_in_asana(asana_id, photo_id, degrees)
        if not ok:
            raise HTTPException(status_code=404, detail="Photo not found or does not belong to this asana")
        return {"message": "Фото повёрнуто и сохранено", "degrees": degrees}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error rotating photo: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/asana/{asana_id}/photo/{photo_id}")
async def delete_asana_photo_endpoint(
    asana_id: str,
    photo_id: str,
    user: str = Depends(is_expert_or_admin)
):
    """Удалить фото асаны (только эксперты и админы)"""
    try:
        # Формируем полные URI
        if not asana_id.startswith('http://'):
            if not asana_id.startswith('asana_'):
                asana_id = f"asana_{asana_id}"
            asana_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"
        
        if not photo_id.startswith('http://'):
            if not photo_id.startswith('photo_'):
                photo_id = f"photo_{photo_id}"
            photo_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{photo_id}"
        
        from app.ontology import delete_photo_from_asana

        result = delete_photo_from_asana(asana_id, photo_id)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail="Photo not found or does not belong to this asana")

        asana_deleted = bool(result.get("asana_deleted"))
        message = "Фото успешно удалено."
        if asana_deleted:
            message += (
                " Запись асаны удалена (не осталось фото) — при необходимости создайте асану заново "
                "из того же источника."
            )
        return {"message": message, "asana_deleted": asana_deleted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting photo: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Маршруты для источников
@app.get("/api/sources")
async def get_sources():
    """Получить все источники (доступно всем)"""
    logger.info("Getting sources list for all users")
    sources = load_sources()
    logger.info(f"Retrieved {len(sources)} sources")
    return sources


@app.get("/api/sources/search")
async def search_sources_api(query: str = Query(..., min_length=1)):
    """Поиск источников по названию, автору, издательству, аннотации и году."""
    logger.info("Searching sources with query: %r", query)
    results = search_sources(query)
    logger.info("Found %s sources for query: %r", len(results), query)
    return results


@app.post("/api/sources")
async def post_source(source: SourceCreate, user: str = Depends(is_expert_or_admin)):
    """Добавить новый источник (только эксперты и админы)"""
    logger.info(f"Adding new source by user: {user}")
    try:
        source_id = add_source(source.dict())
        if not source_id:
            logger.warning(f"Failed to add source: {source}")
            raise HTTPException(status_code=400, detail="Source already exists or invalid")
        logger.info(f"Successfully added source with ID: {source_id}")
        return {"message": "Source added successfully", "id": source_id}
    except Exception as e:
        logger.error(f"Error adding source: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/sources/{source_id:path}")
async def put_source(
    source_id: str,
    source: SourceCreate,
    user: str = Depends(is_expert_or_admin),
):
    """Обновить источник (только эксперты и админы). source_id — полный URI или короткий id/source_UUID."""
    logger.info("Updating source %s by user: %s", source_id, user)
    try:
        update_source_in_ontology(source_id, source.dict())
        return {"message": "Источник обновлён"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Error updating source: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/delete-source")
@app.delete("/api/delete-source/")
async def delete_source(user: str = Depends(is_expert_or_admin), uri: str = Query(...)):
    """Удалить источник (только эксперты и админы)"""
    logger.info(f"Deleting source with URI: {uri} by user: {user}")
    try:
        success = delete_source_from_ontology(uri)
        if not success:
            logger.warning(f"Source not found: {uri}")
            raise HTTPException(status_code=404, detail="Source not found")
        logger.info(f"Successfully deleted source: {uri}")
        return {"message": "Source deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting source: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Маршруты для названий асан
@app.get("/api/asana-names")
async def get_asana_names():
    """Получить все названия асан (доступно всем)"""
    logger.info("Getting asana names list for all users")
    names = load_asana_names()
    logger.info(f"Retrieved {len(names)} asana names")
    return names

@app.post("/api/asana-names")
async def post_asana_name(name: AsanaNameCreate, user: str = Depends(is_expert_or_admin)):
    """Добавить новое название асаны (только эксперты и админы)"""
    logger.info(f"Adding new asana name by user: {user}")
    try:
        name_id = add_asana_name(name.dict())
        if not name_id:
            logger.warning(f"Failed to add asana name: {name}")
            raise HTTPException(status_code=400, detail="Asana name already exists or invalid")
        logger.info(f"Successfully added asana name with ID: {name_id}")
        return {"message": "Asana name added successfully", "id": name_id}
    except Exception as e:
        logger.error(f"Error adding asana name: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/delete-asana-name")
@app.delete("/api/delete-asana-name/")
async def delete_asana_name(user: str = Depends(is_expert_or_admin), uri: str = Query(...)):
    """Удалить название асаны (только эксперты и админы)"""
    logger.info(f"Deleting asana name with URI: {uri} by user: {user}")
    try:
        success = delete_asana_name_from_ontology(uri)
        if not success:
            logger.warning(f"Asana name not found: {uri}")
            raise HTTPException(status_code=404, detail="Asana name not found")
        logger.info(f"Successfully deleted asana name: {uri}")
        return {"message": "Asana name deleted successfully"}
    except ValueError as e:
        logger.warning(f"Cannot delete asana name: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting asana name: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/asana-names")
async def patch_asana_name(
    name: AsanaNameCreate,
    user: str = Depends(is_expert_or_admin),
    uri: str = Query(..., description="URI сущности названия асаны"),
):
    """Изменить поля существующего названия (эксперты и администратор)."""
    logger.info(f"Updating asana name {uri} by user: {user}")
    try:
        update_asana_name(uri, name.dict())
        return {"message": "Asana name updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating asana name: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# Маршруты для информации о проекте и инструкций
@app.get("/api/about-project")
async def get_about_project():
    """Получить информацию о проекте (доступно всем)"""
    logger.info("Getting about project info")
    db = SessionLocal()
    about = db.query(AboutProject).first()
    db.close()
    if not about:
        return {"content": "Информация о проекте отсутствует"}
    return {"content": about.content}

@app.post("/api/about-project")
async def update_about_project(data: TextContent, user: str = Depends(is_admin)):
    """Обновить информацию о проекте (только админ)"""
    logger.info(f"Updating about project info by user: {user}")
    db = SessionLocal()
    about = db.query(AboutProject).first()
    if not about:
        about = AboutProject(content=data.content)
        db.add(about)
    else:
        about.content = data.content
    db.commit()
    db.close()
    return {"message": "About project info updated successfully"}

@app.get("/api/expert-instructions")
async def get_expert_instructions():
    """Получить инструкции для экспертов (доступно всем)"""
    logger.info("Getting expert instructions")
    db = SessionLocal()
    instructions = db.query(ExpertInstructions).first()
    db.close()
    if not instructions:
        return {"content": "Инструкции для экспертов отсутствуют"}
    return {"content": instructions.content}

@app.post("/api/expert-instructions")
async def update_expert_instructions(data: TextContent, user: str = Depends(is_admin)):
    """Обновить инструкции для экспертов (только админ)"""
    logger.info(f"Updating expert instructions by user: {user}")
    db = SessionLocal()
    instructions = db.query(ExpertInstructions).first()
    if not instructions:
        instructions = ExpertInstructions(content=data.content)
        db.add(instructions)
    else:
        instructions.content = data.content
    db.commit()
    db.close()
    return {"message": "Expert instructions updated successfully"}


@app.post("/api/about-project/reset-from-md")
async def reset_about_project_from_md(user: str = Depends(is_admin)):
    """Принудительно перезаписать «О проекте» актуальным содержимым MD-сидера."""
    content = _load_seed_markdown("about_project.md", fallback="")
    if not content:
        raise HTTPException(status_code=404, detail="MD-файл сидера не найден")
    db = SessionLocal()
    try:
        about = db.query(AboutProject).first()
        if not about:
            db.add(AboutProject(content=content))
        else:
            about.content = content
        db.commit()
    finally:
        db.close()
    logger.info("About project content reset from MD by %s", user)
    return {"message": "About project обновлён из MD-сидера", "length": len(content)}


@app.post("/api/expert-instructions/reset-from-md")
async def reset_expert_instructions_from_md(user: str = Depends(is_admin)):
    """Принудительно перезаписать «Инструкции» актуальным содержимым MD-сидера."""
    content = _load_seed_markdown("expert_instructions.md", fallback="")
    if not content:
        raise HTTPException(status_code=404, detail="MD-файл сидера не найден")
    db = SessionLocal()
    try:
        instructions = db.query(ExpertInstructions).first()
        if not instructions:
            db.add(ExpertInstructions(content=content))
        else:
            instructions.content = content
        db.commit()
    finally:
        db.close()
    logger.info("Expert instructions content reset from MD by %s", user)
    return {"message": "Expert instructions обновлён из MD-сидера", "length": len(content)}


@app.post("/api/ontology/migrate-staging-photos", tags=["ontology"])
async def post_migrate_staging_photos(user: str = Depends(is_admin)):
    """
    Разово переносит в MinIO все фото с ключом import-staging в images/asans/…
    и обновляет s3PhotoPath в онтологии. Нужно для старых данных, где в OWL
    ошибочно остались временные пути после импорта Excel.

    Записи, для которых файла в staging уже нет, не меняются — в ответе
    staging_paths_file_missing_in_s3.
    """
    try:
        stats = migrate_staging_s3_photo_paths_in_ontology()
    except Exception as e:
        logger.error("migrate_staging_photos: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    logger.info("migrate_staging_photos by %s: %s", user, stats)
    return stats


# API для модерации
@app.get("/api/moderation/items")
async def get_moderation_items(
    resolved: Optional[bool] = None,
    sort: str = Query("created_at", description="created_at — по дате, name — по названию"),
    sort_dir: str = Query("desc", description="asc или desc"),
    user: str = Depends(is_expert_or_admin)
):
    """Получить список записей на модерацию (только для экспертов и админов)"""
    db = SessionLocal()
    try:
        query = db.query(ModerationItem)
        if resolved is not None:
            query = query.filter(ModerationItem.resolved == resolved)
        else:
            # По умолчанию показываем нерешенные
            query = query.filter(ModerationItem.resolved == False)

        sort_key = (sort or "created_at").lower()
        direction = (sort_dir or "desc").lower()
        descending = direction == "desc"

        if sort_key == "name":
            name_expr = func.lower(
                func.coalesce(ModerationItem.asana_name, ModerationItem.suggested_name_ru, "")
            )
            order_clause = desc(name_expr) if descending else asc(name_expr)
        else:
            order_clause = desc(ModerationItem.created_at) if descending else asc(ModerationItem.created_at)

        items = query.order_by(order_clause).all()
        
        result = []
        for item in items:
            import_data = None
            if item.import_data:
                try:
                    import json
                    import_data = json.loads(item.import_data)
                    if isinstance(import_data, dict):
                        import_data = enrich_moderation_import_data(import_data)
                except Exception:
                    pass
            
            # Определяем тип объекта, если не указан (для старых записей)
            obj_type = item.object_type
            if not obj_type:
                if item.moderation_type in ['duplicate_name', 'name_mismatch'] and not item.source_id:
                    obj_type = 'asana_name'
                elif item.moderation_type == 'duplicate_source' or (item.source_id and 'source' in item.error_message.lower()):
                    obj_type = 'source'
                elif item.source_id and item.asana_name:
                    obj_type = 'asana'
                elif not item.source_id and item.asana_name:
                    obj_type = 'asana_name'
                else:
                    obj_type = 'asana'
            
            result.append({
                "id": item.id,
                "asana_name": item.asana_name,
                "source_id": item.source_id,
                "error_message": item.error_message,
                "row_number": item.row_number,
                "import_data": import_data,
                "created_at": item.created_at,
                "resolved": item.resolved,
                "resolved_by": item.resolved_by,
                "resolved_at": item.resolved_at,
                "moderation_type": item.moderation_type,
                "object_type": obj_type,
                "suggested_name_ru": item.suggested_name_ru,
                "suggested_name_sanskrit": item.suggested_name_sanskrit,
                "suggested_transliteration": item.suggested_transliteration,
                "suggested_definition": item.suggested_definition,
                "existing_name_id": item.existing_name_id,
                "existing_name_ru": item.existing_name_ru
            })
        
        return result
    finally:
        db.close()

@app.get("/api/moderation/items/count")
async def get_moderation_items_count(user: str = Depends(is_expert_or_admin)):
    """Получить количество нерешенных записей на модерацию"""
    db = SessionLocal()
    try:
        count = db.query(ModerationItem).filter(ModerationItem.resolved == False).count()
        return {"count": count}
    finally:
        db.close()


@app.delete("/api/moderation/items/all")
async def delete_all_moderation_items(user: str = Depends(is_expert_or_admin)):
    """Безвозвратно удалить все записи модерации (эксперт и администратор)."""
    from app.s3_utils import delete_all_objects_with_prefix

    staging_folder = (S3_IMPORT_STAGING_PREFIX or "").strip().strip("/")
    s3_removed = 0
    if staging_folder:
        try:
            s3_removed = delete_all_objects_with_prefix(
                NAME_BUCKET_IMAGES_MINIO,
                f"{staging_folder}/",
            )
        except Exception as e:
            logger.warning(
                "Moderation S3 staging cleanup failed (continuing with DB clear): %s",
                e,
                exc_info=True,
            )
    db = SessionLocal()
    try:
        deleted = db.query(ModerationItem).delete(synchronize_session=False)
        db.commit()
        logger.info(
            "Moderation table cleared by %s, deleted %s rows, s3_staging_removed=%s (prefix=%r)",
            user,
            deleted,
            s3_removed,
            staging_folder,
        )
        return {
            "deleted": deleted,
            "s3_staging_removed": s3_removed,
            "message": "Все записи модерации удалены",
        }
    finally:
        db.close()


@app.post("/api/moderation/items/{item_id}/add-asana")
async def add_asana_from_moderation(
    item_id: int,
    name_id: str = Form(...),
    source_id: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    keep_photo_from_request: str = Form("false"),
    user: str = Depends(is_expert_or_admin)
):
    """Добавить асану из записи модерации"""
    db = SessionLocal()
    try:
        item = db.query(ModerationItem).filter(ModerationItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        
        # Проверяем, существует ли уже асана с таким названием и источником ДО обработки фото
        from app.ontology import (
            ASANA,
            find_existing_asana,
            get_graph,
            collect_photo_hash_dedup_pairs_for_source,
            norm_image_hash_hex,
            norm_s3_path,
            rdf_property_value_str,
        )
        from rdflib import URIRef
        from app.photo_dedup import (
            compute_photo_dedup_fingerprint,
            photo_matches_any_existing,
            norm_dedup_fp,
        )

        existing_asana_id = find_existing_asana(name_id, source_id)
        
        # Если асана уже существует, получаем пары (MD5, dedup) и пути S3
        existing_photo_pairs: List[tuple] = []
        existing_photo_paths = set()
        if existing_asana_id:
            g = get_graph()
            asana_uri = URIRef(existing_asana_id)
            source_uri = URIRef(source_id)
            existing_photo_pairs = collect_photo_hash_dedup_pairs_for_source(g, asana_uri, source_uri)
            existing_photos = list(g.objects(asana_uri, ASANA.hasPhoto))
            for existing_photo_uri in existing_photos:
                existing_photo_source = g.value(existing_photo_uri, ASANA.hasSource)
                if existing_photo_source == source_uri:
                    existing_s3_path = g.value(existing_photo_uri, ASANA.s3PhotoPath)
                    if existing_s3_path:
                        existing_photo_paths.add(norm_s3_path(rdf_property_value_str(existing_s3_path)))
        
        # Обработка фото — списки путей S3 (несколько после Excel staging)
        photo_paths: List[str] = []
        photo_hashes_list: List[Any] = []
        photo_dedup_list: List[Optional[str]] = []
        keep_photo = keep_photo_from_request.lower() == "true"

        if photo:
            try:
                from app.s3_utils import compute_image_hash, upload_image_to_s3

                photo_content = await photo.read()
                ph = compute_image_hash(photo_content)
                pd = compute_photo_dedup_fingerprint(photo_content)
                ph_n = norm_image_hash_hex(ph)
                pd_n = norm_dedup_fp(pd)
                logger.info("Photo computed hash: %s", ph)
                if existing_asana_id and photo_matches_any_existing(ph_n, pd_n, existing_photo_pairs):
                    logger.info("[INFO MAIN] Photo is duplicate (dedup/MD5), skipping upload to S3")
                else:
                    pth, _ = upload_image_to_s3(photo_content, prefix="asans")
                    photo_paths = [pth]
                    photo_hashes_list = [ph]
                    photo_dedup_list = [pd if pd else None]
                    logger.info("Photo uploaded to S3: %s, hash: %s", pth, ph)
            except Exception as e:
                logger.error("Error processing photo: %s", e, exc_info=True)
                logger.warning("Failed to process photo from form upload")
        elif keep_photo and item.import_data:
            try:
                import_data = parse_moderation_item_import(item.import_data)
                if isinstance(import_data, dict):
                    pi = import_data.get("photo_info")
                    if isinstance(pi, dict) and pi.get("removed"):
                        logger.warning("Photo was removed from import_data (photo_info.removed)")
                    staged = import_data.get("_staged_import_photos") or []
                    tmp_paths: List[str] = []
                    tmp_hashes: List[Any] = []
                    tmp_dedups: List[Optional[str]] = []
                    if isinstance(staged, list):
                        for e in staged:
                            if isinstance(e, dict) and e.get("s3_path"):
                                tmp_paths.append(norm_s3_path(e["s3_path"]))
                                h = e.get("hash")
                                tmp_hashes.append(norm_image_hash_hex(h) if h else None)
                                dfp = e.get("dedup_fp")
                                tmp_dedups.append(str(dfp).strip() if dfp else None)
                    if tmp_paths:
                        if existing_asana_id:
                            seen_m_path: set[str] = set()
                            seen_m_pair: List[tuple] = []
                            for i, p in enumerate(tmp_paths):
                                hs = tmp_hashes[i] if i < len(tmp_hashes) else None
                                ds = tmp_dedups[i] if i < len(tmp_dedups) else None
                                p_n = norm_s3_path(p)
                                h_n = norm_image_hash_hex(hs) if hs else ""
                                d_n = norm_dedup_fp(ds) if ds else ""
                                if not p_n or not h_n:
                                    continue
                                if p_n in existing_photo_paths or p_n in seen_m_path:
                                    continue
                                if photo_matches_any_existing(h_n, d_n, existing_photo_pairs):
                                    continue
                                if any(photo_matches_any_existing(h_n, d_n, [sp]) for sp in seen_m_pair):
                                    continue
                                seen_m_path.add(p_n)
                                seen_m_pair.append((h_n, d_n))
                                photo_paths.append(p_n)
                                photo_hashes_list.append(hs)
                                photo_dedup_list.append(ds)
                        else:
                            photo_paths = tmp_paths
                            photo_hashes_list = tmp_hashes
                            photo_dedup_list = tmp_dedups
                    else:
                        img_bytes = image_bytes_from_import_dict(import_data)
                        if img_bytes:
                            from app.s3_utils import compute_image_hash, upload_image_to_s3

                            ph = compute_image_hash(img_bytes)
                            pd = compute_photo_dedup_fingerprint(img_bytes)
                            logger.info(
                                "[INFO MAIN] Photo from import bytes, hash=%s, size=%s",
                                ph,
                                len(img_bytes),
                            )
                            ph_n = norm_image_hash_hex(ph)
                            pd_n = norm_dedup_fp(pd)
                            if existing_asana_id and photo_matches_any_existing(ph_n, pd_n, existing_photo_pairs):
                                logger.info("[INFO MAIN] Import image duplicate by dedup/MD5, skipping S3 upload")
                            else:
                                pth, h2 = upload_image_to_s3(img_bytes, prefix="asans")
                                photo_paths = [pth]
                                photo_hashes_list = [h2 or ph]
                                photo_dedup_list = [pd if pd else None]
                                logger.info("[INFO MAIN] Uploaded moderation import image to S3: %s", pth)
                        else:
                            logger.warning(
                                "[INFO MAIN] keep_photo set but no image bytes / staged paths in import_data"
                            )
            except Exception as e:
                logger.error("Error processing import_data photo: %s", e, exc_info=True)

        # Если асана уже существует, проверяем результат
        if existing_asana_id:
            if photo_paths:
                if len(photo_paths) == 1:
                    ph0 = photo_hashes_list[0] if photo_hashes_list else None
                    pd0 = photo_dedup_list[0] if photo_dedup_list else None
                    p0 = photo_paths[0]
                    ph0_n = norm_image_hash_hex(ph0) if ph0 else ""
                    pd0_n = norm_dedup_fp(pd0) if pd0 else ""
                    if ph0 and photo_matches_any_existing(ph0_n, pd0_n, existing_photo_pairs):
                        logger.info(
                            "[INFO MAIN] Asana from moderation already exists with identical photo (dedup/MD5), skipping"
                        )
                        item.resolved = True
                        item.resolved_by = user
                        from datetime import datetime

                        item.resolved_at = datetime.now().isoformat()
                        db.commit()
                        return {
                            "message": "Asana already exists with identical photo",
                            "id": existing_asana_id,
                            "skipped": True,
                        }
                    if norm_s3_path(p0) in existing_photo_paths:
                        logger.info(
                            "[INFO MAIN] Asana from moderation already exists with identical photo, skipping"
                        )
                        item.resolved = True
                        item.resolved_by = user
                        from datetime import datetime

                        item.resolved_at = datetime.now().isoformat()
                        db.commit()
                        return {
                            "message": "Asana already exists with identical photo",
                            "id": existing_asana_id,
                            "skipped": True,
                        }
                logger.info("[INFO MAIN] Adding photo(s) to existing asana from moderation")
                try:
                    asana_id = add_asana(
                        name_id=name_id,
                        source_id=source_id,
                        photo_paths=photo_paths,
                        photo_hashes=photo_hashes_list if photo_hashes_list else None,
                        photo_dedup_fingerprints=photo_dedup_list if photo_dedup_list else None,
                    )
                    item.resolved = True
                    item.resolved_by = user
                    from datetime import datetime

                    item.resolved_at = datetime.now().isoformat()
                    db.commit()
                    return {"message": "Фото добавлено к существующей асане", "id": asana_id}
                except Exception as e:
                    logger.error("Error adding photo to existing asana: %s", e, exc_info=True)
                    db.rollback()
                    raise HTTPException(status_code=400, detail=f"Ошибка при добавлении асаны: {str(e)}")
            if existing_photo_pairs or existing_photo_paths:
                logger.info("[INFO MAIN] Asana from moderation already exists with photos, skipping")
                item.resolved = True
                item.resolved_by = user
                from datetime import datetime

                item.resolved_at = datetime.now().isoformat()
                db.commit()
                return {"message": "Asana already exists with photos", "id": existing_asana_id, "skipped": True}
            logger.info(
                "[INFO MAIN] Asana from moderation already exists without photos, skipping identical record"
            )
            item.resolved = True
            item.resolved_by = user
            from datetime import datetime

            item.resolved_at = datetime.now().isoformat()
            db.commit()
            return {"message": "Asana already exists (identical record)", "id": existing_asana_id, "skipped": True}

        # Асана не существует, создаем новую (только с фото)
        if not photo_paths:
            raise HTTPException(
                status_code=400,
                detail="Нельзя создать асану из модерации без фото: загрузите файл, включите фото из импорта или исправьте загрузку в S3.",
            )
        try:
            asana_id = add_asana(
                name_id=name_id,
                source_id=source_id,
                photo_paths=photo_paths,
                photo_hashes=photo_hashes_list if photo_hashes_list else None,
                photo_dedup_fingerprints=photo_dedup_list if photo_dedup_list else None,
            )
            # Успешно создано - отмечаем как решенную
            item.resolved = True
            item.resolved_by = user
            from datetime import datetime
            item.resolved_at = datetime.now().isoformat()
            db.commit()
            return {"message": "Запись отмечена как решенная", "id": asana_id}
        except Exception as e:
            logger.error(f"Error adding asana from moderation: {e}", exc_info=True)
            db.rollback()
            # НЕ помечаем как решенную - оставляем в модерации
            raise HTTPException(status_code=400, detail=f"Ошибка при добавлении асаны: {str(e)}")
    finally:
        db.close()

@app.get("/api/asana/{asana_id}/photo-by-source/{source_id}")
async def get_asana_photo_by_source(asana_id: str, source_id: str):
    """
    Получить фото асаны из конкретного источника (если есть)
    """
    photo = get_photo_of_asana_from_source(asana_id, source_id)
    if photo:
        return {"photo": photo}
    return {"photo": None}


# API для работы с isSameAsObject (аналогичные асаны)

class SameAsRequest(BaseModel):
    target_asana_id: str

@app.get("/api/asana/{asana_id}/similar", tags=["asana"])
async def get_asana_similar(asana_id: str = Path(...)):
    """
    Получить список аналогичных асан (связанных через isSameAsObject).
    Доступно всем пользователям.
    """
    logger.info(f"Getting similar asanas for: {asana_id}")
    try:
        similar = get_similar_asanas(asana_id)
        return similar
    except Exception as e:
        logger.error(f"Error getting similar asanas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/asana/{asana_id}/same-as", tags=["asana"])
async def add_asana_same_as(
    asana_id: str = Path(...),
    request: SameAsRequest = None,
    user: str = Depends(is_expert_or_admin)
):
    """
    Указать совпадение между двумя асанами (только эксперты и админы).
    Добавляет связь isSameAsObject в онтологию.
    """
    logger.info(f"Adding isSameAsObject: {asana_id} -> {request.target_asana_id} by user: {user}")
    try:
        success = add_same_as_object(asana_id, request.target_asana_id)
        if success:
            return {"message": "Совпадение успешно указано"}
        else:
            raise HTTPException(status_code=400, detail="Не удалось добавить связь")
    except Exception as e:
        logger.error(f"Error adding same as object: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/asana/{asana_id}/same-as/{target_asana_id}", tags=["asana"])
async def remove_asana_same_as(
    asana_id: str = Path(...),
    target_asana_id: str = Path(...),
    user: str = Depends(is_expert_or_admin)
):
    """
    Удалить связь isSameAsObject между двумя асанами (только эксперты и админы).
    """
    logger.info(f"Removing isSameAsObject: {asana_id} <-> {target_asana_id} by user: {user}")
    try:
        success = remove_same_as_object(asana_id, target_asana_id)
        if success:
            return {"message": "Связь успешно удалена"}
        else:
            raise HTTPException(status_code=400, detail="Не удалось удалить связь")
    except Exception as e:
        logger.error(f"Error removing same as object: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AI / модерация isSameAs от нейросети
# Сервис asana-network-service сканирует фото каталога и предлагает связи
# isSameAsObject между асанами с одинаковыми (с точностью до поворота) фото
# или с одинаковым предсказанным классом yoga-82. Эксперт/админ подтверждает
# или отклоняет каждое предложение.
# ============================================

class AIScanRequest(BaseModel):
    use_yoga_class: bool = True
    yoga_class_threshold: float = 0.55
    skip_existing_links: bool = True


def _serialize_proposal(item: AISimilarityProposal) -> Dict[str, Any]:
    return {
        "id": item.id,
        "asana_a_id": item.asana_a_id,
        "asana_b_id": item.asana_b_id,
        "photo_a_id": item.photo_a_id,
        "photo_b_id": item.photo_b_id,
        "score": float(item.score or 0.0),
        "reason": item.reason,
        "detail": item.detail,
        "status": item.status,
        "created_at": item.created_at,
        "reviewed_at": item.reviewed_at,
        "reviewed_by": item.reviewed_by,
    }


def _enrich_proposal_with_asanas(
    proposal: Dict[str, Any], asana_index: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    a = asana_index.get(proposal.get("asana_a_id") or "") or {}
    b = asana_index.get(proposal.get("asana_b_id") or "") or {}

    def _find_photo(asana: Dict[str, Any], photo_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not asana or not photo_id:
            return None
        for p in asana.get("photos") or []:
            if p.get("id") == photo_id:
                return p
        return None

    def _source_for_photo(
        asana: Dict[str, Any], photo: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Возвращает источник, к которому привязано конкретное фото внутри асаны.
        Это важно: при одном русском названии асаны разные источники ⇒ разные
        записи в каталоге, и эксперту нужно видеть, из какой книги пришла каждая
        сторона предложения isSameAs.
        """
        if not asana:
            return None
        sources = asana.get("sources") or []
        src_uri = (photo or {}).get("source") if photo else None
        if src_uri:
            for s in sources:
                if s.get("id") == src_uri:
                    return {
                        "id": s.get("id"),
                        "title": s.get("title") or "",
                        "author": s.get("author") or "",
                        "year": s.get("year"),
                    }
            return {"id": src_uri, "title": "", "author": "", "year": None}
        # Запасной вариант — первый источник асаны (если photo_id не нашёлся).
        if sources:
            s = sources[0]
            return {
                "id": s.get("id"),
                "title": s.get("title") or "",
                "author": s.get("author") or "",
                "year": s.get("year"),
            }
        return None

    def _short(asana: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": asana.get("id"),
            "name_ru": (asana.get("name") or {}).get("name_ru") or "",
            "name_sanskrit": (asana.get("name") or {}).get("name_sanskrit") or "",
        }

    photo_a = _find_photo(a, proposal.get("photo_a_id"))
    photo_b = _find_photo(b, proposal.get("photo_b_id"))

    def _photo_url(asana: Dict[str, Any], found_photo: Optional[Dict[str, Any]]) -> Optional[str]:
        if found_photo and found_photo.get("image"):
            return found_photo.get("image")
        photos = (asana or {}).get("photos") or []
        return photos[0].get("image") if photos else None

    proposal["asana_a"] = _short(a) if a else {"id": proposal.get("asana_a_id")}
    proposal["asana_b"] = _short(b) if b else {"id": proposal.get("asana_b_id")}
    proposal["photo_a_url"] = _photo_url(a, photo_a)
    proposal["photo_b_url"] = _photo_url(b, photo_b)
    proposal["source_a"] = _source_for_photo(a, photo_a)
    proposal["source_b"] = _source_for_photo(b, photo_b)
    return proposal


@app.post("/api/ai/scan", tags=["ai"])
async def ai_scan(
    payload: AIScanRequest = AIScanRequest(),
    user: str = Depends(is_expert_or_admin),
):
    """
    Запускает сканирование каталога нейросетью и кладёт найденные кандидаты
    isSameAs в очередь модерации. Возвращает агрегированную статистику.
    """
    from app.ai_similarity import run_ai_scan_and_save

    logger.info("AI scan: запуск пользователем %s", user)
    db = SessionLocal()
    try:
        stats = run_ai_scan_and_save(
            db,
            use_yoga_class=payload.use_yoga_class,
            yoga_class_threshold=payload.yoga_class_threshold,
            skip_existing_links=payload.skip_existing_links,
        )
        return {"message": "Сканирование завершено", "stats": stats}
    except httpx.HTTPError as e:
        logger.error("AI scan: HTTP error: %s", e)
        raise HTTPException(status_code=502, detail=f"Нейросервис недоступен: {e}")
    except Exception as e:
        logger.error("AI scan: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка сканирования: {e}")
    finally:
        db.close()


@app.get("/api/ai/proposals", tags=["ai"])
async def get_ai_proposals(
    resolved: bool = Query(False, description="false → pending, true → confirmed+rejected"),
    sort: str = Query("created_at", pattern="^(created_at|score)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(500, ge=1, le=1000),
    user: str = Depends(is_expert_or_admin),
):
    """
    Список предложений ИИ для модерации.

    - ``resolved=false`` (по умолчанию) — только ``pending``;
    - ``resolved=true`` — обработанные (``confirmed`` и ``rejected``).

    Сортировка: ``created_at`` (по умолчанию) или ``score``, направление —
    ``asc``/``desc``. Дополнительно подмешиваем русские названия и URL фото
    для отображения в интерфейсе.
    """
    db = SessionLocal()
    try:
        q = db.query(AISimilarityProposal)
        if resolved:
            q = q.filter(AISimilarityProposal.status.in_(["confirmed", "rejected"]))
        else:
            q = q.filter(AISimilarityProposal.status == "pending")

        sort_col = (
            AISimilarityProposal.score
            if sort == "score"
            else AISimilarityProposal.created_at
        )
        q = q.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())
        q = q.limit(limit)
        rows = [_serialize_proposal(r) for r in q.all()]
    finally:
        db.close()

    try:
        asana_index = {a["id"]: a for a in load_asanas()}
    except Exception as e:  # noqa: BLE001
        logger.warning("Не удалось загрузить каталог для обогащения предложений: %s", e)
        asana_index = {}

    enriched = [_enrich_proposal_with_asanas(r, asana_index) for r in rows]
    return enriched


@app.get("/api/ai/proposals/count", tags=["ai"])
async def get_ai_proposals_count(user: str = Depends(is_expert_or_admin)):
    """Количество предложений, ожидающих модерации (для бейджа в navbar)."""
    db = SessionLocal()
    try:
        cnt = (
            db.query(AISimilarityProposal)
            .filter(AISimilarityProposal.status == "pending")
            .count()
        )
        return {"count": int(cnt or 0)}
    finally:
        db.close()


@app.patch("/api/ai/proposals/{proposal_id}/confirm", tags=["ai"])
async def confirm_ai_proposal(
    proposal_id: int = Path(..., ge=1),
    user: str = Depends(is_expert_or_admin),
):
    """
    Подтверждает предложение ИИ: создаёт связь isSameAsObject между двумя
    асанами и помечает предложение как confirmed.
    """
    db = SessionLocal()
    try:
        item = db.query(AISimilarityProposal).filter(AISimilarityProposal.id == proposal_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Предложение не найдено")
        if item.status != "pending":
            raise HTTPException(
                status_code=400, detail=f"Предложение уже обработано (status={item.status})"
            )
        ok = add_same_as_object(item.asana_a_id, item.asana_b_id)
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="Не удалось установить связь (одна из асан могла быть удалена)",
            )
        item.status = "confirmed"
        item.reviewed_at = datetime.utcnow().isoformat()
        item.reviewed_by = user
        db.commit()
        return {"message": "Связь подтверждена", "proposal": _serialize_proposal(item)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("confirm_ai_proposal error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.patch("/api/ai/proposals/{proposal_id}/reject", tags=["ai"])
async def reject_ai_proposal(
    proposal_id: int = Path(..., ge=1),
    user: str = Depends(is_expert_or_admin),
):
    """Отклоняет предложение ИИ — связь не создаётся, заявка снимается с модерации."""
    db = SessionLocal()
    try:
        item = db.query(AISimilarityProposal).filter(AISimilarityProposal.id == proposal_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Предложение не найдено")
        if item.status != "pending":
            raise HTTPException(
                status_code=400, detail=f"Предложение уже обработано (status={item.status})"
            )
        item.status = "rejected"
        item.reviewed_at = datetime.utcnow().isoformat()
        item.reviewed_by = user
        db.commit()
        return {"message": "Предложение отклонено", "proposal": _serialize_proposal(item)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("reject_ai_proposal error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.delete("/api/ai/proposals/all", tags=["ai"])
async def clear_ai_proposals(
    only_resolved: bool = Query(False),
    user: str = Depends(is_expert_or_admin),
):
    """Удаляет предложения. По умолчанию очищает всё (как в обычной модерации)."""
    db = SessionLocal()
    try:
        q = db.query(AISimilarityProposal)
        if only_resolved:
            q = q.filter(AISimilarityProposal.status.in_(["confirmed", "rejected"]))
        deleted = q.delete(synchronize_session=False)
        db.commit()
        return {"deleted": int(deleted or 0)}
    except Exception as e:
        db.rollback()
        logger.error("clear_ai_proposals error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


templates = Jinja2Templates(directory="frontend/app/templates")

def get_user_role_from_request(request: Request) -> str:
    """
    Получает роль пользователя из токена через server-module API.
    Если сервис недоступен, использует fallback на локальную проверку токена.
    Возвращает None для неавторизованных пользователей (вместо 'guest').
    """
    token = request.cookies.get('access_token') or request.cookies.get('session_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    
    try:
        # Пробуем получить информацию о пользователе через server-module
        from app.auth import get_user_info_from_token_sync
        user_data = get_user_info_from_token_sync(token)
        if user_data:
            is_admin = user_data.get("is_admin", False)
            permission_study = user_data.get("permission_study", False)
            # Маппинг: is_admin → admin, permission_study → expert
            if is_admin:
                return 'admin'
            elif permission_study:
                return 'expert'
            else:
                # Обычный пользователь (не админ и не эксперт) = неавторизованный
                return None
    except Exception as e:
        logger.warning(f"Failed to get user role from auth service: {str(e)}, using fallback")
    
    # Fallback: проверяем токен локально (если в токене есть роль)
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        role = payload.get('role')
        if role and role in ['admin', 'expert']:
            return role
        # Если роли нет в токене или это не админ/эксперт, возвращаем None
        return None
    except JWTError:
        return None

def get_asana_by_id(asana_id: str):
    """
    Получает асану по ID. Поддерживает как полный URI, так и короткий ID.
    """
    logger.info(f"get_asana_by_id called with ID: {asana_id}")
    
    # Если передан не полный URI, добавляем префикс
    if not asana_id.startswith('http'):
        # Проверяем, начинается ли ID с 'asana_'
        if not asana_id.startswith('asana_'):
            asana_id = f"asana_{asana_id}"
        asana_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"
    
    logger.info(f"Searching for asana with URI: {asana_id}")
    asanas = load_asanas()
    logger.info(f"Loaded {len(asanas)} asanas")
    
    for asana in asanas:
        logger.debug(f"Comparing with asana ID: {asana['id']}")
        if asana["id"] == asana_id:
            logger.info(f"Found matching asana: {asana['name']['name_ru']}")
            return asana
    
    logger.warning(f"No asana found with ID: {asana_id}")
    return None

@app.get("/asanas-page")
def asanas_page(request: Request, search_query: str = '', current_letter: str = ''):
    asanas = load_asanas()
    grouped_asanas = {}  # группировка по буквам
    for asana in asanas:
        first_letter = asana["name"]["ru"][0].upper() if asana["name"]["ru"] else "?"
        grouped_asanas.setdefault(first_letter, []).append(asana)
    
    # Получаем роль пользователя
    user_role = get_user_role_from_request(request)
    is_authenticated = user_role is not None
    is_expert_or_admin = user_role in ['admin', 'expert']
    
    return templates.TemplateResponse(
        "asana_list.html",
        {
            "request": request,
            "grouped_asanas": grouped_asanas,
            "search_query": search_query,
            "current_letter": current_letter,
            "user_role": user_role,
            "is_authenticated": is_authenticated,
            "is_expert_or_admin": is_expert_or_admin,
            "is_admin": user_role == 'admin'
        }
    )

@app.get("/asana/{asana_id}-page", tags=["asana"])
def asana_detail_page(request: Request, asana_id: str = Path(...)):
    """
    Страница деталей асаны. Поддерживает как полный URI, так и короткий ID.
    """
    logger.info(f"Received request for asana details with ID: {asana_id}")
    
    # Убираем суффикс -page, если он есть
    if asana_id.endswith('-page'):
        asana_id = asana_id[:-5]
    
    # Если передан не полный URI, добавляем префикс
    if not asana_id.startswith('http'):
        # Проверяем, начинается ли ID с 'asana_'
        if not asana_id.startswith('asana_'):
            asana_id = f"asana_{asana_id}"
        full_uri = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"
        logger.info(f"Converted ID to full URI: {full_uri}")
        asana_id = full_uri
    
    logger.info(f"Looking for asana with ID: {asana_id}")
    asana = get_asana_by_id(asana_id)
    
    if not asana:
        logger.error(f"Asana not found with ID: {asana_id}")
        raise HTTPException(status_code=404, detail="Асана не найдена")
    
    logger.info(f"Found asana: {asana['name']['name_ru']}")
    sources = load_sources()
    return templates.TemplateResponse(
        "asana_detail.html",
        {
            "request": request,
            "asana": asana,
            "sources": sources,
            "user_role": get_user_role_from_request(request)
        }
    )

@app.get("/sources-page")
def sources_page(request: Request):
    sources = load_sources()
    return templates.TemplateResponse("sources.html", {"request": request, "sources": sources, "user_role": get_user_role_from_request(request)})

@app.get("/settings-page")
def settings_page(request: Request):
    user_role = get_user_role_from_request(request)
    if user_role != 'admin':
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request,
            "user_role": user_role,
            "is_admin": True,
            "is_authenticated": True,
            "is_expert_or_admin": True,
        }
    )

@app.get("/about-page")
def about_page(request: Request):
    db = SessionLocal()
    about = db.query(AboutProject).first()
    db.close()
    content = about.content if about else "Информация о проекте отсутствует"
    
    user_role = get_user_role_from_request(request)
    
    return templates.TemplateResponse(
        "about_project.html", 
        {
            "request": request, 
            "content": content, 
            "user_role": user_role,
            "is_authenticated": user_role is not None,
            "is_expert_or_admin": user_role in ['admin', 'expert'],
            "is_admin": user_role == 'admin'
        }
    )

@app.get("/expert-instructions-page")
def expert_instructions_page(request: Request):
    db = SessionLocal()
    instructions = db.query(ExpertInstructions).first()
    db.close()
    content = instructions.content if instructions else "Инструкции для экспертов отсутствуют"
    
    user_role = get_user_role_from_request(request)
    
    return templates.TemplateResponse(
        "expert_instructions.html",
        {
            "request": request,
            "content": content,
            "user_role": user_role,
            "is_authenticated": user_role is not None,
            "is_expert_or_admin": user_role in ['admin', 'expert'],
            "is_admin": user_role == 'admin'
        }
    )

@app.get("/sources/add")
def add_source_page(request: Request):
    """Страница добавления источника (только для expert/admin)"""
    user_role = get_user_role_from_request(request)
    if user_role not in ['admin', 'expert']:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    return templates.TemplateResponse(
        "add_source.html",
        {
            "request": request,
            "user_role": user_role,
            "is_admin": user_role == 'admin',
            "is_authenticated": True,
            "is_expert_or_admin": True,
            "year": datetime.now().year
        }
    )

# API routes
# Дубликат удаляем, уже есть выше
async def api_search_asanas(query: str, fuzzy: bool = True):
    """Поиск асан по имени"""
    try:
        asanas = search_asanas_by_name(query, fuzzy)
        return {"asanas": asanas}
    except Exception as e:
        logger.error(f"Error searching asanas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Управление пользователями теперь через server-module API
# Используйте эндпоинты server-module для управления пользователями

@app.get("/api/auth/check")
async def check_auth(request: Request):
    """Проверка авторизации пользователя"""
    token = request.cookies.get('session_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return {
            "is_authenticated": False,
            "role": None
        }
    
    user_role = get_user_role_from_request(request)
    # Если есть валидный токен - пользователь авторизован (admin или expert)
    return {
        "is_authenticated": True,
        "role": user_role
    }

# API для управления пользователями (только для админа)
class UserCreate(BaseModel):
    login: str
    mail: EmailStr
    password: str
    is_admin: bool = False
    permission_study: bool = False

class UserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    permission_study: Optional[bool] = None
    is_blocked: Optional[bool] = None


def _public_site_url() -> str:
    """Базовый URL сайта для ссылок в письмах."""
    explicit = (os.getenv("PUBLIC_SITE_URL") or os.getenv("SITE_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    minio_prefix = (os.getenv("MINIO_URL_PREFIX") or "").strip().rstrip("/")
    if minio_prefix.endswith("/images"):
        return minio_prefix[: -len("/images")]
    if minio_prefix:
        return minio_prefix
    return "https://catalog-asan.ru"


def _login_page_url() -> str:
    return f"{_public_site_url()}/login"


def _send_new_user_credentials_email(login: str, email: str, plain_password: str) -> None:
    """Отправляет новому пользователю письмо с логином и паролем."""
    site_url = _public_site_url()
    login_url = _login_page_url()
    send_email(
        email,
        "Доступ к Каталогу асан",
        "Вам создана учетная запись в системе \"Каталог асан\".\n\n"
        f"Сайт: {site_url}\n"
        f"Вход: {login_url}\n\n"
        f"Логин: {login}\n"
        f"Пароль: {plain_password}\n\n"
        "Рекомендуем сменить пароль после первого входа в профиле.",
    )


def _generate_temporary_password(length: int = 14) -> str:
    """Генерирует временный пароль с цифрами/буквами/спецсимволами."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%^&*()-_=+" for c in pwd)
        ):
            return pwd


def _send_unblock_credentials_email(login: str, email: str, plain_password: str) -> None:
    """Отправляет письмо с новым паролем после разблокировки учетной записи."""
    send_email(
        email,
        "Учетная запись разблокирована",
        "Ваша учетная запись в системе \"Каталог асан\" разблокирована администратором.\n\n"
        f"Логин: {login}\n"
        f"Новый пароль: {plain_password}\n\n"
        "Рекомендуем сменить пароль сразу после входа.",
    )


def _audit_summary_from_row(row: AuditEvent) -> str:
    """Человекочитаемое описание для старых и новых записей аудита."""
    if row.details:
        try:
            payload = json.loads(row.details)
            if isinstance(payload, dict) and payload.get("summary"):
                return str(payload["summary"])
        except (json.JSONDecodeError, TypeError):
            pass
    if row.action_code and ":" not in row.action_code:
        parts = [row.action_code.replace(".", " ").replace("_", " ")]
        if row.entity_id:
            parts.append(str(row.entity_id))
        return " — ".join(parts)
    return f"{row.method} {row.path}"


@app.get("/api/audit/events", tags=["audit"])
async def get_audit_events(
    user: str = Depends(is_admin),
    login: Optional[str] = Query(default=None),
    action_code: Optional[str] = Query(default=None),
    from_ts: Optional[str] = Query(default=None),
    to_ts: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
):
    from datetime import datetime, timedelta
    from app.models import User

    retention_days = int(os.getenv("AUDIT_RETENTION_DAYS", "7"))
    if not from_ts:
        from_ts = (datetime.utcnow() - timedelta(days=retention_days)).isoformat()

    db = SessionLocal()
    try:
        privileged_logins = {
            row[0]
            for row in db.query(User.login).filter(
                (User.is_admin == True) | (User.permission_study == True)  # noqa: E712
            ).all()
            if row[0]
        }

        query = db.query(AuditEvent).filter(AuditEvent.status_code < 400)
        if privileged_logins:
            query = query.filter(AuditEvent.login.in_(list(privileged_logins)))
        else:
            query = query.filter(AuditEvent.login.isnot(None))

        if login:
            query = query.filter(AuditEvent.login == login)
        if action_code:
            query = query.filter(AuditEvent.action_code.ilike(f"%{action_code}%"))
        if from_ts:
            query = query.filter(AuditEvent.timestamp >= from_ts)
        if to_ts:
            query = query.filter(AuditEvent.timestamp <= to_ts)

        total = query.count()
        rows = query.order_by(desc(AuditEvent.id)).offset(offset).limit(limit).all()
        return {
            "total": total,
            "items": [
                {
                    "id": row.id,
                    "timestamp": row.timestamp,
                    "login": row.login,
                    "avatar_url": row.avatar_url,
                    "method": row.method,
                    "path": row.path,
                    "status_code": row.status_code,
                    "action_code": row.action_code,
                    "entity_type": row.entity_type,
                    "entity_id": row.entity_id,
                    "ip": row.ip,
                    "details": row.details,
                    "summary": _audit_summary_from_row(row),
                }
                for row in rows
            ],
        }
    except Exception as exc:
        logger.error("Error fetching audit events: %s", exc)
        raise HTTPException(status_code=500, detail="Ошибка при получении аудита")
    finally:
        db.close()

@app.get("/api/users", tags=["users"])
async def get_all_users(request: Request, user: str = Depends(is_admin)):
    """Получить список всех пользователей (только для админа)"""
    import httpx
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
    
    try:
        # Делаем запрос к server-module для получения всех пользователей
        # Если такого endpoint нет, работаем напрямую с БД
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{config.AUTH_SERVICE_URL}/api/users",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-DB-Schema": "public"  # Пользователи в основной схеме
                }
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.warning(f"Failed to get users from server-module: {str(e)}, using direct DB access")
    
    # Fallback: работаем напрямую с БД
    # Пользователи хранятся в схеме dict_schema для asana-dict-service
    db = SessionLocal()
    try:
        # Получаем пользователей из схемы dict_schema
        users = db.query(User).filter(User.is_verify == True).all()
        result = []
        for u in users:
            result.append({
                "id": u.id,
                "login": u.login,
                "mail": u.mail,
                "is_admin": u.is_admin,
                "permission_study": u.permission_study,
                "is_verify": u.is_verify,
                "is_blocked": bool(getattr(u, "is_blocked", False)),
                "avatar_url": u.avatar_url,
            })
        return result
    except Exception as e:
        logger.error(f"Error getting users from DB: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении пользователей: {str(e)}")
    finally:
        db.close()

@app.post("/api/users", tags=["users"])
async def create_user(user_data: UserCreate, user: str = Depends(is_admin)):
    """Создать нового пользователя (только для админа)"""
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    db = SessionLocal()
    try:
        # Проверяем, что пользователь с таким login не существует
        existing_user = db.query(User).filter(User.login == user_data.login).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
        
        # Проверяем, что пользователь с таким mail не существует
        existing_mail = db.query(User).filter(User.mail == user_data.mail).first()
        if existing_mail:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
        
        # Создаем нового пользователя
        plain_password = user_data.password
        hashed_password = pwd_context.hash(plain_password)
        new_user = User(
            login=user_data.login,
            mail=user_data.mail,
            password=hashed_password,
            is_admin=user_data.is_admin,
            permission_study=user_data.permission_study,
            is_verify=True,  # Админ создает сразу верифицированных пользователей
            is_blocked=False,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        email_sent = True
        email_error = None
        try:
            _send_new_user_credentials_email(new_user.login, new_user.mail, plain_password)
        except Exception as email_exc:
            email_sent = False
            email_error = str(email_exc).strip() or email_exc.__class__.__name__
            logger.error(
                "Failed to send new-user credentials email for %s (%s): %s",
                new_user.login,
                new_user.mail,
                email_exc,
            )

        logger.info(f"Admin {user} created new user: {user_data.login}")
        return {
            "id": new_user.id,
            "login": new_user.login,
            "mail": new_user.mail,
            "is_admin": new_user.is_admin,
            "permission_study": new_user.permission_study,
            "is_verify": new_user.is_verify,
            "is_blocked": bool(getattr(new_user, "is_blocked", False)),
            "avatar_url": new_user.avatar_url,
            "email_sent": email_sent,
            "email_error": email_error,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при создании пользователя: {str(e)}")
    finally:
        db.close()

@app.patch("/api/users/{user_id}", tags=["users"])
async def update_user(user_id: int, user_update: UserUpdate, request: Request, user: str = Depends(is_admin)):
    """Обновить роль пользователя (только для админа)"""
    db = SessionLocal()
    try:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Не позволяем изменять самого себя
        token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
        current_user_data = get_user_info_from_token_sync(token)
        if current_user_data and current_user_data.get("login") == target_user.login:
            raise HTTPException(status_code=400, detail="Нельзя изменить роль самого себя")
        
        if user_update.is_admin is not None:
            target_user.is_admin = user_update.is_admin
        if user_update.permission_study is not None:
            target_user.permission_study = user_update.permission_study
        if user_update.is_blocked is not None:
            target_user.is_blocked = user_update.is_blocked
        
        db.commit()
        db.refresh(target_user)
        
        logger.info(f"Admin {user} updated user {target_user.login}: is_admin={target_user.is_admin}, permission_study={target_user.permission_study}")
        return {
            "id": target_user.id,
            "login": target_user.login,
            "mail": target_user.mail,
            "is_admin": target_user.is_admin,
            "permission_study": target_user.permission_study,
            "is_verify": target_user.is_verify,
            "is_blocked": bool(getattr(target_user, "is_blocked", False)),
            "avatar_url": target_user.avatar_url,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении пользователя: {str(e)}")
    finally:
        db.close()


@app.post("/api/users/{user_id}/block", tags=["users"])
async def block_user(user_id: int, request: Request, user: str = Depends(is_admin)):
    """Заблокировать учетную запись пользователя."""
    db = SessionLocal()
    try:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
        current_user_data = get_user_info_from_token_sync(token)
        if current_user_data and current_user_data.get("login") == target_user.login:
            raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

        target_user.is_blocked = True
        db.commit()
        db.refresh(target_user)
        logger.info("Admin %s blocked user %s", user, target_user.login)
        return {"message": f"Пользователь {target_user.login} заблокирован", "is_blocked": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error blocking user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при блокировке пользователя: {str(e)}")
    finally:
        db.close()


@app.post("/api/users/{user_id}/unblock", tags=["users"])
async def unblock_user(user_id: int, user: str = Depends(is_admin)):
    """
    Разблокировать учетную запись пользователя, сгенерировать новый пароль
    и отправить его на email пользователя.
    """
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()
    try:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        temp_password = _generate_temporary_password()
        target_user.password = pwd_context.hash(temp_password)
        target_user.is_blocked = False
        db.commit()
        db.refresh(target_user)

        try:
            _send_unblock_credentials_email(target_user.login, target_user.mail, temp_password)
        except Exception as email_exc:
            target_user.is_blocked = True
            db.commit()
            logger.error(
                "Failed to send unblock credentials email for %s (%s): %s",
                target_user.login,
                target_user.mail,
                email_exc,
            )
            raise HTTPException(
                status_code=500,
                detail="Не удалось отправить новый пароль на почту. Разблокировка отменена.",
            )

        logger.info("Admin %s unblocked user %s and sent new password", user, target_user.login)
        return {
            "message": f"Пользователь {target_user.login} разблокирован, новый пароль отправлен на email",
            "is_blocked": False,
            "email_sent": True,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error unblocking user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при разблокировке пользователя: {str(e)}")
    finally:
        db.close()


@app.delete("/api/users/{user_id}", tags=["users"])
async def delete_user(user_id: int, request: Request, user: str = Depends(is_admin)):
    """Удалить пользователя (только для админа)"""
    db = SessionLocal()
    try:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Не позволяем удалить самого себя
        token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
        current_user_data = get_user_info_from_token_sync(token)
        if current_user_data and current_user_data.get("login") == target_user.login:
            raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
        
        user_login = target_user.login
        db.delete(target_user)
        db.commit()
        
        logger.info(f"Admin {user} deleted user: {user_login}")
        return {"message": f"Пользователь {user_login} успешно удален"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении пользователя: {str(e)}")
    finally:
        db.close()