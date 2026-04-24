from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile, Query, Request, Path
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict
from pydantic import BaseModel
import base64
import os
import logging
import json
import uuid
import asyncio
from datetime import datetime
from starlette.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from app.auth import (
    get_current_user, is_admin, is_expert_or_admin, get_user_info_from_token_sync
)
from app.ontology import (
    add_asana_name, add_source, load_asana_names, load_asanas, add_asana, load_sources,
    delete_source_from_ontology, delete_asana_name_from_ontology, delete_asana_from_ontology,
    add_photo_to_asana, get_asanas_by_first_letter, get_asanas_by_source, search_asanas_by_name,
    get_photo_of_asana_from_source, get_similar_asanas, add_same_as_object, remove_same_as_object,
    update_asana_name,
)
from app.moderation_photo import parse_moderation_item_import, image_bytes_from_import_dict
from app.config import logger
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from app.models import Base, AboutProject, ExpertInstructions, UserRole, User, ModerationItem
from sqlalchemy import create_engine, func, asc, desc
from sqlalchemy.orm import sessionmaker
from app import config
from fastapi.templating import Jinja2Templates
from jose import jwt, JWTError

# Create module logger
logger = logging.getLogger("asana_service.api")

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
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Middleware для защиты документации API
class DocsAuthMiddleware(BaseHTTPMiddleware):
    """Middleware для защиты документации API - только для авторизованных пользователей (админ/эксперт)"""
    
    async def dispatch(self, request: StarletteRequest, call_next):
        # Проверяем, является ли запрос к документации
        path = request.url.path
        
        # Защищаем основные пути документации
        # Также защищаем статические файлы Swagger UI (они загружаются через /docs/static/...)
        protected_paths = ["/docs", "/redoc", "/openapi.json"]
        is_protected = any(path == protected or path.startswith(protected + "/") for protected in protected_paths)
        
        if is_protected:
            # Получаем токен из заголовков или cookies
            token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token") or request.cookies.get("session_token")
            
            if not token:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Требуется авторизация для доступа к документации API"}
                )
            
            # Проверяем авторизацию и роль пользователя
            try:
                user_data = get_user_info_from_token_sync(token)
                if not user_data:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Недействительный токен авторизации"}
                    )
                
                # Проверяем, что пользователь является админом или экспертом
                is_admin_flag = user_data.get("is_admin", False)
                permission_study = user_data.get("permission_study", False)
                
                if not (is_admin_flag or permission_study):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Доступ к документации API разрешен только администраторам и экспертам"}
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

# Добавляем middleware для защиты документации (перед CORS)
app.add_middleware(DocsAuthMiddleware)

# Разрешаем CORS для всех источников (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                    Base.metadata.create_all(
                        bind=conn,
                        tables=[
                            User.__table__,
                            AboutProject.__table__,
                            ExpertInstructions.__table__,
                            ModerationItem.__table__,
                            CatalogSyncState.__table__,
                            CatalogMirrorItem.__table__,
                            ImportBatch.__table__,
                            ImportStagingRow.__table__,
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
def create_default_content():
    """Создание контента по умолчанию"""
    db = SessionLocal()
    
    if not db.query(AboutProject).first():
        about = AboutProject(content="О проекте каталога асан")
        db.add(about)
        logger.info("Created default about project content")
    
    if not db.query(ExpertInstructions).first():
        instructions = ExpertInstructions(content="Инструкция для экспертов")
        db.add(instructions)
        logger.info("Created default expert instructions")
    
    db.commit()
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
    """Поиск асан по названию (доступно всем)"""
    logger.info(f"Searching asanas with query: {query}, fuzzy: {fuzzy}")
    if fuzzy:
        asanas = search_asanas_by_name(query)
    else:
        # Простой поиск по подстроке
        all_asanas = load_asanas()
        asanas = [a for a in all_asanas if query.lower() in a["name"]["ru"].lower()]
    
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
        from app.ontology import find_existing_asana, get_graph, ASANA
        from rdflib import URIRef
        existing_asana_id = find_existing_asana(name_id, source_id)
        
        # Если асана уже существует, получаем существующие хеши ДО загрузки фото в S3
        existing_photo_hashes = set()
        if existing_asana_id:
            g = get_graph()
            asana_uri = URIRef(existing_asana_id)
            source_uri = URIRef(source_id)
            
            # Получаем все фото этой асаны с этим источником
            existing_photos = list(g.objects(asana_uri, ASANA.hasPhoto))
            for existing_photo_uri in existing_photos:
                existing_photo_source = g.value(existing_photo_uri, ASANA.hasSource)
                if existing_photo_source == source_uri:
                    # Приоритет: проверяем хеш, если есть
                    existing_hash = g.value(existing_photo_uri, ASANA.photoHash)
                    if existing_hash:
                        existing_photo_hashes.add(str(existing_hash))
        
        # Обработка фото - вычисляем хеши ДО загрузки в S3, загружаем только новые
        photo_s3_paths = []
        photo_hashes = []
        all_photos_were_duplicates = False
        if photos:
            logger.info(f"[DEBUG MAIN] Processing {len(photos)} photo(s)")
            from app.s3_utils import upload_image_to_s3, compute_image_hash
            processed_hashes = []  # Все хеши, включая дубликаты
            for idx, photo in enumerate(photos):
                try:
                    photo_content = await photo.read()
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: read {len(photo_content)} bytes")
                    
                    # Вычисляем хеш ДО загрузки в S3
                    photo_hash = compute_image_hash(photo_content)
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: computed hash={photo_hash}")
                    processed_hashes.append(photo_hash)
                    
                    # Проверяем, не является ли это дубликатом
                    if existing_asana_id and photo_hash in existing_photo_hashes:
                        logger.info(f"[INFO MAIN] Photo {idx+1} is duplicate (hash exists), skipping upload to S3")
                        continue  # Пропускаем загрузку дубликата
                    
                    # Загружаем в S3 только если фото новое
                    photo_s3_path, _ = upload_image_to_s3(photo_content, prefix="asans")
                    logger.info(f"[DEBUG MAIN] Photo {idx+1}: uploaded to S3, path={photo_s3_path}, hash={photo_hash}")
                    photo_s3_paths.append(photo_s3_path)
                    photo_hashes.append(photo_hash)
                    logger.info(f"[DEBUG MAIN] Photo {idx+1} added to list. Total paths: {len(photo_s3_paths)}")
                except Exception as e:
                    logger.error(f"[ERROR MAIN] Error processing photo {idx+1}: {e}", exc_info=True)
                    # НЕ сохраняем base64! Пропускаем фото при ошибке
                    logger.warning(f"[WARNING MAIN] Skipping photo {idx+1} due to error - will add asana without this photo")
            
            # Проверяем, все ли фото были дубликатами
            if existing_asana_id and processed_hashes and all(h in existing_photo_hashes for h in processed_hashes):
                all_photos_were_duplicates = True
        else:
            logger.info(f"[DEBUG MAIN] No photos provided in request")

        # Если асана уже существует, проверяем результат
        if existing_asana_id:
            # Проверяем, есть ли новые фото для добавления
            if photo_hashes:
                # Есть новые фото, добавляем их к существующей асане
                logger.info(f"[INFO MAIN] Adding {len(photo_hashes)} new photo(s) to existing asana")
                asana_id = add_asana(name_id=name_id, source_id=source_id, photo_paths=photo_s3_paths, photo_hashes=photo_hashes)
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
        asana_id = add_asana(name_id=name_id, source_id=source_id, photo_paths=photo_s3_paths, photo_hashes=photo_hashes)
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
        success = delete_photo_from_asana(asana_id, photo_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Photo not found or does not belong to this asana")
        
        return {"message": "Фото успешно удалено"}
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
                except:
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
    db = SessionLocal()
    try:
        deleted = db.query(ModerationItem).delete(synchronize_session=False)
        db.commit()
        logger.info("Moderation table cleared by %s, deleted %s rows", user, deleted)
        return {"deleted": deleted, "message": "Все записи модерации удалены"}
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
        from app.ontology import find_existing_asana, get_graph, ASANA
        from rdflib import URIRef
        existing_asana_id = find_existing_asana(name_id, source_id)
        
        # Если асана уже существует, получаем существующие хеши ДО загрузки фото в S3
        existing_photo_hashes = set()
        existing_photo_paths = set()
        if existing_asana_id:
            g = get_graph()
            asana_uri = URIRef(existing_asana_id)
            source_uri = URIRef(source_id)
            
            # Получаем все фото этой асаны с этим источником
            existing_photos = list(g.objects(asana_uri, ASANA.hasPhoto))
            for existing_photo_uri in existing_photos:
                existing_photo_source = g.value(existing_photo_uri, ASANA.hasSource)
                if existing_photo_source == source_uri:
                    # Приоритет: проверяем хеш, если есть
                    existing_hash = g.value(existing_photo_uri, ASANA.photoHash)
                    if existing_hash:
                        existing_photo_hashes.add(str(existing_hash))
                    # Также сохраняем пути для обратной совместимости
                    existing_s3_path = g.value(existing_photo_uri, ASANA.s3PhotoPath)
                    if existing_s3_path:
                        existing_photo_paths.add(str(existing_s3_path))
        
        # Обработка фото
        photo_s3_path = None
        photo_hash = None
        keep_photo = keep_photo_from_request.lower() == 'true'
        
        if photo:
            # Если загружено новое фото, вычисляем хеш ДО загрузки в S3
            try:
                from app.s3_utils import upload_image_to_s3, compute_image_hash
                photo_content = await photo.read()
                
                # Вычисляем хеш ДО загрузки в S3
                photo_hash = compute_image_hash(photo_content)
                logger.info(f"Photo computed hash: {photo_hash}")
                
                # Проверяем, не является ли это дубликатом
                if existing_asana_id and photo_hash in existing_photo_hashes:
                    logger.info(f"[INFO MAIN] Photo is duplicate (hash exists), skipping upload to S3")
                    # Не загружаем в S3, но используем хеш для проверки
                else:
                    # Загружаем в S3 только если фото новое
                    photo_s3_path, _ = upload_image_to_s3(photo_content, prefix="asans")
                    logger.info(f"Photo uploaded to S3: {photo_s3_path}, hash: {photo_hash}")
            except Exception as e:
                logger.error(f"Error processing photo: {e}", exc_info=True)
                # НЕ сохраняем base64! Оставляем None при ошибке
                photo_s3_path = None
                photo_hash = None
                logger.warning(f"Failed to process photo - will add asana without photo")
        elif keep_photo and item.import_data:
            # Фото из сохранённого импорта: photo / photo_base64 / photo_url (см. moderation_photo.py)
            try:
                import_data = parse_moderation_item_import(item.import_data)
                if isinstance(import_data, dict):
                    pi = import_data.get("photo_info")
                    if isinstance(pi, dict) and pi.get("removed"):
                        logger.warning("Photo was removed from import_data (photo_info.removed)")
                    img_bytes = image_bytes_from_import_dict(import_data)
                    if img_bytes:
                        from app.s3_utils import upload_image_to_s3, compute_image_hash
                        photo_hash = compute_image_hash(img_bytes)
                        logger.info(f"[INFO MAIN] Photo from import bytes, hash={photo_hash}, size={len(img_bytes)}")
                        if existing_asana_id and photo_hash in existing_photo_hashes:
                            logger.info("[INFO MAIN] Import image duplicate by hash, skipping S3 upload")
                        else:
                            photo_s3_path, _ = upload_image_to_s3(img_bytes, prefix="asans")
                            logger.info(f"[INFO MAIN] Uploaded moderation import image to S3: {photo_s3_path}")
                    else:
                        logger.warning("[INFO MAIN] keep_photo set but no image bytes extracted from import_data")
            except Exception as e:
                logger.error(f"Error processing import_data photo: {e}", exc_info=True)
        
        photo_paths = [photo_s3_path] if photo_s3_path else []
        photo_hashes = [photo_hash] if photo_hash else []
        
        # Если асана уже существует, проверяем результат
        if existing_asana_id:
            # Проверяем, идентичны ли фото по хешам
            if photo_hash:
                # Есть фото в запросе
                if photo_hash in existing_photo_hashes:
                    # Фото идентично по хешу
                    logger.info(f"[INFO MAIN] Asana from moderation already exists with identical photo (by hash), skipping")
                    item.resolved = True
                    item.resolved_by = user
                    from datetime import datetime
                    item.resolved_at = datetime.now().isoformat()
                    db.commit()
                    return {"message": "Asana already exists with identical photo", "id": existing_asana_id, "skipped": True}
                elif photo_s3_path in existing_photo_paths:
                    # Фото идентично - запись полностью идентична
                    logger.info(f"[INFO MAIN] Asana from moderation already exists with identical photo, skipping")
                    # Отмечаем как решенную
                    item.resolved = True
                    item.resolved_by = user
                    from datetime import datetime
                    item.resolved_at = datetime.now().isoformat()
                    db.commit()
                    return {"message": "Asana already exists with identical photo", "id": existing_asana_id, "skipped": True}
                else:
                    # Фото новое, добавляем его к существующей асане
                    logger.info(f"[INFO MAIN] Adding new photo to existing asana from moderation")
                    photo_hashes_list = [photo_hash] if photo_hash else []
                    try:
                        asana_id = add_asana(name_id=name_id, source_id=source_id, photo_paths=photo_paths, photo_hashes=photo_hashes_list)
                        # Успешно добавлено - отмечаем как решенную
                        item.resolved = True
                        item.resolved_by = user
                        from datetime import datetime
                        item.resolved_at = datetime.now().isoformat()
                        db.commit()
                        return {"message": "Фото добавлено к существующей асане", "id": asana_id}
                    except Exception as e:
                        logger.error(f"Error adding photo to existing asana: {e}", exc_info=True)
                        db.rollback()
                        # НЕ помечаем как решенную - оставляем в модерации
                        raise HTTPException(status_code=400, detail=f"Ошибка при добавлении асаны: {str(e)}")
            else:
                # Фото нет в запросе
                if existing_photo_hashes or existing_photo_paths:
                    # У асаны есть фото, в запросе нет - пропускаем
                    logger.info(f"[INFO MAIN] Asana from moderation already exists with photos, skipping")
                    item.resolved = True
                    item.resolved_by = user
                    from datetime import datetime
                    item.resolved_at = datetime.now().isoformat()
                    db.commit()
                    return {"message": "Asana already exists with photos", "id": existing_asana_id, "skipped": True}
                else:
                    # У асаны нет фото и в запросе нет - идентичная запись
                    logger.info(f"[INFO MAIN] Asana from moderation already exists without photos, skipping identical record")
                    item.resolved = True
                    item.resolved_by = user
                    from datetime import datetime
                    item.resolved_at = datetime.now().isoformat()
                    db.commit()
                    return {"message": "Asana already exists (identical record)", "id": existing_asana_id, "skipped": True}
        
        # Асана не существует, создаем новую (только с фото)
        photo_hashes_list = [photo_hash] if photo_hash else []
        if not photo_paths:
            raise HTTPException(
                status_code=400,
                detail="Нельзя создать асану из модерации без фото: загрузите файл, включите фото из импорта или исправьте загрузку в S3.",
            )
        try:
            asana_id = add_asana(name_id=name_id, source_id=source_id, photo_paths=photo_paths, photo_hashes=photo_hashes_list)
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
    mail: str
    password: str
    is_admin: bool = False
    permission_study: bool = False

class UserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    permission_study: Optional[bool] = None

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
                "is_verify": u.is_verify
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
        hashed_password = pwd_context.hash(user_data.password)
        new_user = User(
            login=user_data.login,
            mail=user_data.mail,
            password=hashed_password,
            is_admin=user_data.is_admin,
            permission_study=user_data.permission_study,
            is_verify=True  # Админ создает сразу верифицированных пользователей
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"Admin {user} created new user: {user_data.login}")
        return {
            "id": new_user.id,
            "login": new_user.login,
            "mail": new_user.mail,
            "is_admin": new_user.is_admin,
            "permission_study": new_user.permission_study,
            "is_verify": new_user.is_verify
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
        
        db.commit()
        db.refresh(target_user)
        
        logger.info(f"Admin {user} updated user {target_user.login}: is_admin={target_user.is_admin}, permission_study={target_user.permission_study}")
        return {
            "id": target_user.id,
            "login": target_user.login,
            "mail": target_user.mail,
            "is_admin": target_user.is_admin,
            "permission_study": target_user.permission_study,
            "is_verify": target_user.is_verify
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