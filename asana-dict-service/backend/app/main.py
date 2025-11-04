from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile, Query, Request, Path, BackgroundTasks
from typing import Optional, List, Dict
from pydantic import BaseModel
import base64
import os
import logging
import json
import uuid
import asyncio
from starlette.responses import RedirectResponse
from app.auth import (
    get_current_user, is_admin, is_expert_or_admin
)
from app.ontology import (
    add_asana_name, add_source, load_asana_names, load_asanas, add_asana, load_sources,
    delete_source_from_ontology, delete_asana_name_from_ontology, delete_asana_from_ontology, 
    add_photo_to_asana, get_asanas_by_first_letter, get_asanas_by_source, search_asanas_by_name,
    get_photo_of_asana_from_source
)
from app.config import logger
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from app.models import Base, AboutProject, ExpertInstructions, UserRole, User, ModerationItem
from sqlalchemy import create_engine
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
    contact={"email": config.APP_CONTACT_EMAIL}
)

# Разрешаем CORS для всех источников (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None
SessionLocal = None

# Хранилище статусов задач импорта
import_tasks: Dict[str, Dict] = {}

def init_database():
    """Инициализация базы данных"""
    global engine, SessionLocal
    
    if engine is None:
        engine = create_engine(config.SQLALCHEMY_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Создаем схему если её нет
        from sqlalchemy import text
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE SCHEMA IF NOT EXISTS dict_schema"))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to create schema: {e}")
            raise
        
        # Создаем все таблицы включая User в схеме dict_schema
        from app.models import AboutProject, ExpertInstructions, User, ModerationItem
        try:
            Base.metadata.create_all(bind=engine, tables=[
                User.__table__, 
                AboutProject.__table__, 
                ExpertInstructions.__table__,
                ModerationItem.__table__
            ])
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
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
            'moderation_type': 'VARCHAR(50)'
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

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    try:
        init_database()
        add_moderation_columns_if_needed()
        create_default_content()
        create_default_users()
        
        # Настраиваем MinIO bucket policy для публичного доступа к изображениям
        try:
            from app.s3_utils import setup_minio_bucket_policy
            setup_minio_bucket_policy()
        except Exception as e:
            logger.warning(f"Failed to setup MinIO bucket policy: {e}. This is not critical, but images may not be accessible.")
        
        logger.info("Application startup completed successfully")
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
    
    # Создаем guest пользователя
    guest_login = os.getenv("GUEST_USERNAME", "guest")
    guest_password = os.getenv("GUEST_PASSWORD", "guest123")
    
    if not db.query(User).filter(User.login == guest_login).first():
        guest_user = User(
            login=guest_login,
            mail=f"{guest_login}@example.com",
            password=hash_password(guest_password),
            is_admin=False,
            permission_study=False,
            is_verify=True
        )
        db.add(guest_user)
        logger.info(f"Created default guest user: {guest_login}")
    
    db.commit()
    db.close()

# Инициализация выполняется в startup event

# Маршруты аутентификации и авторизации
# Авторизация и регистрация теперь обрабатываются внешним сервисом
# Токены приходят извне и проверяются через get_user_role_from_request

# Логаут теперь обрабатывается фронтендом
# @app.get("/logout")

# Маршруты для асан
@app.get("/asanas", tags=["asana"])
async def get_asanas():
    """Получить все асаны (доступно всем)"""
    logger.info("Getting asanas list for all users")
    asanas = load_asanas()
    logger.info(f"Retrieved {len(asanas)} asanas")
    return asanas

@app.get("/asanas/by-letter/{letter}", tags=["asana"])
async def get_asanas_by_letter(letter: str):
    """Получить асаны, начинающиеся с определенной буквы (доступно всем)"""
    logger.info(f"Getting asanas starting with letter: {letter}")
    asanas = get_asanas_by_first_letter(letter)
    return asanas

@app.get("/asanas/by-source/{source_id}", tags=["asana"])
async def get_source_asanas(source_id: str):
    """Получить асаны из определенного источника (доступно всем)"""
    logger.info(f"Getting asanas from source: {source_id}")
    asanas = get_asanas_by_source(source_id)
    return asanas

@app.get("/asanas/search", tags=["asana"])
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

@app.post("/asana", tags=["asana"])
async def post_asana(
    selected_name: str = Form(...),
    new_name_ru: Optional[str] = Form(None),
    new_name_sanskrit: Optional[str] = Form(None),
    transliteration: Optional[str] = Form(None),
    definition: Optional[str] = Form(None),
    selected_source: str = Form(...),
    new_source_title: Optional[str] = Form(None),
    new_source_author: Optional[str] = Form(None),
    new_source_year: Optional[int] = Form(None),
    new_source_publisher: Optional[str] = Form(None),
    new_source_pages: Optional[int] = Form(None),
    new_source_annotation: Optional[str] = Form(None),
    photo: UploadFile = File(...),
    user: str = Depends(is_expert_or_admin)
):
    """Добавить новую асану (только эксперты и админы)"""
    try:
        logger.info(f"Adding new asana by user: {user}")
        logger.debug(f"Form data received - selected_name: {selected_name}, selected_source: {selected_source}")
        logger.debug(f"New name data: ru={new_name_ru}, sanskrit={new_name_sanskrit}")
        logger.debug(f"New source data: title={new_source_title}, author={new_source_author}, year={new_source_year}")
        logger.debug(f"Photo filename: {photo.filename}")
        
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
            source_data = {
                "title": new_source_title,
                "author": new_source_author,
                "year": int(new_source_year)
            }
            
            # Добавляем необязательные поля, если они есть
            if new_source_publisher:
                source_data["publisher"] = new_source_publisher
            if new_source_pages:
                source_data["pages"] = int(new_source_pages)
            if new_source_annotation:
                source_data["annotation"] = new_source_annotation
                
            source_id = add_source(source_data)
            logger.debug(f"Created new source with ID: {source_id}")
        else:
            logger.error("Missing required source fields for new source")
            raise HTTPException(status_code=400, detail="При добавлении нового источника поля автора, названия и года обязательны")

        # Обработка фото - загружаем в S3
        photo_s3_path = None
        if photo:
            logger.info("Processing photo upload to S3")
            try:
                from app.s3_utils import upload_image_to_s3
                photo_content = await photo.read()
                photo_base64_str = base64.b64encode(photo_content).decode()
                # Преобразуем в data URI формат
                photo_data_uri = f"data:image/jpeg;base64,{photo_base64_str}"
                photo_s3_path = upload_image_to_s3(photo_data_uri, prefix="asans")
                logger.info(f"Photo uploaded to S3: {photo_s3_path}")
            except Exception as e:
                logger.error(f"Error uploading photo to S3: {e}")
                # В случае ошибки используем base64 как fallback
                photo_base64 = base64.b64encode(photo_content).decode()
                photo_s3_path = photo_base64

        # Добавляем асану
        logger.info("Adding asana to ontology")
        asana_id = add_asana(name_id=name_id, source_id=source_id, photo_path=photo_s3_path or "")
        logger.info(f"Successfully created asana with ID: {asana_id}")
        
        return {"message": "Asana added successfully", "id": asana_id}
    except Exception as e:
        logger.error(f"Error adding asana: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/asanas")
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

@app.post("/asana/{asana_id}/add-photo")
async def add_asana_photo_endpoint(
    asana_id: str, 
    source_id: str = Form(...),
    photos: List[UploadFile] = File(...), 
    user: str = Depends(is_expert_or_admin)
):
    """Добавить фото к асане (только эксперты и админы)"""
    try:
        results = []
        for photo in photos:
            photo_bytes = await photo.read()
            photo_uri = add_photo_to_asana(asana_id, photo_bytes, source_id)
            results.append(photo_uri)
        return {"message": "Фото добавлены", "photo_ids": results}
    except Exception as e:
        logger.error(f"Error adding photo to asana: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Маршруты для источников
@app.get("/sources")
async def get_sources():
    """Получить все источники (доступно всем)"""
    logger.info("Getting sources list for all users")
    sources = load_sources()
    logger.info(f"Retrieved {len(sources)} sources")
    return sources

@app.post("/sources")
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

@app.delete("/delete-source")
@app.delete("/delete-source/")
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
@app.get("/asana-names")
async def get_asana_names():
    """Получить все названия асан (доступно всем)"""
    logger.info("Getting asana names list for all users")
    names = load_asana_names()
    logger.info(f"Retrieved {len(names)} asana names")
    return names

@app.post("/asana-names")
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

@app.delete("/delete-asana-name")
@app.delete("/delete-asana-name/")
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
    except Exception as e:
        logger.error(f"Error deleting asana name: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Маршруты для информации о проекте и инструкций
@app.get("/about-project")
async def get_about_project():
    """Получить информацию о проекте (доступно всем)"""
    logger.info("Getting about project info")
    db = SessionLocal()
    about = db.query(AboutProject).first()
    db.close()
    if not about:
        return {"content": "Информация о проекте отсутствует"}
    return {"content": about.content}

@app.post("/about-project")
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

@app.get("/expert-instructions")
async def get_expert_instructions():
    """Получить инструкции для экспертов (доступно всем)"""
    logger.info("Getting expert instructions")
    db = SessionLocal()
    instructions = db.query(ExpertInstructions).first()
    db.close()
    if not instructions:
        return {"content": "Инструкции для экспертов отсутствуют"}
    return {"content": instructions.content}

@app.post("/expert-instructions")
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

# Маршрут для скачивания/загрузки онтологии
@app.get("/download-ontology")
async def download_ontology(user: str = Depends(is_admin)):
    """Скачать файл онтологии (только админ)"""
    logger.info(f"Downloading ontology file by user: {user}")
    if not os.path.exists(config.OWL_FILE_PATH):
        logger.error("Ontology file not found")
        raise HTTPException(status_code=404, detail="Файл онтологии не найден")
    logger.info("Ontology file found, sending to client")
    return FileResponse(
        path=config.OWL_FILE_PATH,
        filename="asana_ontology.owl",
        media_type="application/rdf+xml"
    )

@app.post("/upload-ontology")
async def upload_ontology(ontology_file: UploadFile = File(...), user: str = Depends(is_admin)):
    """Загрузить файл онтологии (только админ)"""
    logger.info(f"Uploading ontology file by user: {user}")
    try:
        content = await ontology_file.read()
        with open(config.OWL_FILE_PATH, "wb") as f:
            f.write(content)
        logger.info("Ontology file uploaded successfully")
        return {"message": "Ontology file uploaded successfully"}
    except Exception as e:
        logger.error(f"Error uploading ontology file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error uploading ontology file: {str(e)}")

def run_import_asanas_task(task_id: str, tmp_path: str, source_id: str, user: str):
    """Фоновая задача для импорта асан"""
    try:
        import_tasks[task_id]["status"] = "processing"
        import_tasks[task_id]["progress"] = 0
        
        from app.excel_import import import_asanas_from_excel
        
        result = import_asanas_from_excel(tmp_path, source_id, user=user)
        error_count = len(result.get('errors', []))
        
        import_tasks[task_id]["status"] = "completed"
        import_tasks[task_id]["progress"] = 100
        import_tasks[task_id]["result"] = {
            "imported": result.get('imported', 0),
            "errors_count": error_count,
            "errors": result.get('errors', [])[:10]  # Только первые 10 ошибок
        }
        
        # Удаляем временный файл
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    except Exception as e:
        import_tasks[task_id]["status"] = "error"
        import_tasks[task_id]["error"] = str(e)
        logger.error(f"Error in import task {task_id}: {str(e)}", exc_info=True)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/import/asanas")
async def import_asanas(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_id: str = Form(...),
    user: str = Depends(is_expert_or_admin)
):
    """Импорт асан из Excel файла с привязкой к существующему источнику (асинхронно)"""
    logger.info(f"Starting async import of asanas from Excel by user: {user}")
    try:
        # Сохраняем файл временно
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Создаем задачу
        task_id = str(uuid.uuid4())
        import_tasks[task_id] = {
            "status": "pending",
            "progress": 0,
            "type": "asanas",
            "user": user
        }
        
        # Запускаем фоновую задачу
        background_tasks.add_task(run_import_asanas_task, task_id, tmp_path, source_id, user)
        
        return {
            "task_id": task_id,
            "message": "Импорт запущен в фоновом режиме",
            "status_url": f"/import/status/{task_id}"
        }
    except Exception as e:
        logger.error(f"Error starting import task: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка при запуске импорта: {str(e)}")

def run_import_full_task(task_id: str, tmp_path: str, user: str):
    """Фоновая задача для полного импорта"""
    try:
        import_tasks[task_id]["status"] = "processing"
        import_tasks[task_id]["progress"] = 0
        
        from app.excel_import import import_full_from_excel
        
        result = import_full_from_excel(tmp_path, user=user)
        error_count = len(result.get('errors', []))
        
        import_tasks[task_id]["status"] = "completed"
        import_tasks[task_id]["progress"] = 100
        import_tasks[task_id]["result"] = {
            "imported_asanas": result.get('imported_asanas', 0),
            "imported_sources": result.get('imported_sources', 0),
            "errors_count": error_count,
            "errors": result.get('errors', [])[:10]  # Только первые 10 ошибок
        }
        
        # Удаляем временный файл
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    except Exception as e:
        import_tasks[task_id]["status"] = "error"
        import_tasks[task_id]["error"] = str(e)
        logger.error(f"Error in import task {task_id}: {str(e)}", exc_info=True)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/import/full")
async def import_full(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: str = Depends(is_expert_or_admin)
):
    """Импорт асан и источников из Excel файла (полный импорт, асинхронно)"""
    logger.info(f"Starting async import of full data from Excel by user: {user}")
    try:
        # Сохраняем файл временно
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Создаем задачу
        task_id = str(uuid.uuid4())
        import_tasks[task_id] = {
            "status": "pending",
            "progress": 0,
            "type": "full",
            "user": user
        }
        
        # Запускаем фоновую задачу
        background_tasks.add_task(run_import_full_task, task_id, tmp_path, user)
        
        return {
            "task_id": task_id,
            "message": "Импорт запущен в фоновом режиме",
            "status_url": f"/import/status/{task_id}"
        }
    except Exception as e:
        logger.error(f"Error starting import task: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка при запуске импорта: {str(e)}")

@app.post("/import/asana-names")
async def import_asana_names(
    file: UploadFile = File(...),
    user: str = Depends(is_expert_or_admin)
):
    """Импорт названий асан из Excel файла (только админ)"""
    logger.info(f"Importing asana names from Excel by user: {user}")
    try:
        from app.excel_import import import_asana_names_from_excel
        
        # Сохраняем файл временно
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            result = import_asana_names_from_excel(tmp_path, user=user)
            error_count = len(result.get('errors', []))
            return {
                "message": f"Успешно импортировано {result['imported']} названий, пропущено {result['skipped']}" + (f", {error_count} ошибок" if error_count > 0 else ""),
                "imported": result['imported'],
                "skipped": result['skipped'],
                "errors_count": error_count,
                "errors": result.get('errors', [])
            }
        finally:
            # Удаляем временный файл
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        logger.error(f"Error importing asana names: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка при импорте названий асан: {str(e)}")

# API для модерации
@app.get("/moderation/items")
async def get_moderation_items(
    resolved: Optional[bool] = None,
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
        
        items = query.order_by(ModerationItem.created_at.desc()).all()
        
        result = []
        for item in items:
            import_data = None
            if item.import_data:
                try:
                    import json
                    import_data = json.loads(item.import_data)
                except:
                    pass
            
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

@app.get("/moderation/items/count")
async def get_moderation_items_count(user: str = Depends(is_expert_or_admin)):
    """Получить количество нерешенных записей на модерацию"""
    db = SessionLocal()
    try:
        count = db.query(ModerationItem).filter(ModerationItem.resolved == False).count()
        return {"count": count}
    finally:
        db.close()

@app.post("/moderation/items/{item_id}/add-asana")
async def add_asana_from_moderation(
    item_id: int,
    name_id: str = Form(...),
    source_id: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    user: str = Depends(is_expert_or_admin)
):
    """Добавить асану из записи модерации"""
    db = SessionLocal()
    try:
        item = db.query(ModerationItem).filter(ModerationItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        
        # Обработка фото
        photo_s3_path = None
        if photo:
            try:
                from app.s3_utils import upload_image_to_s3
                photo_content = await photo.read()
                photo_base64_str = base64.b64encode(photo_content).decode()
                photo_data_uri = f"data:image/jpeg;base64,{photo_base64_str}"
                photo_s3_path = upload_image_to_s3(photo_data_uri, prefix="asans")
            except Exception as e:
                logger.error(f"Error uploading photo to S3: {e}")
                photo_base64 = base64.b64encode(photo_content).decode()
                photo_s3_path = photo_base64
        elif item.import_data:
            # Парсим JSON если это строка
            import json
            try:
                if isinstance(item.import_data, str):
                    import_data = json.loads(item.import_data)
                else:
                    import_data = item.import_data
                
                # Если фото есть в данных импорта
                if isinstance(import_data, dict) and 'photo' in import_data:
                    photo_data = import_data['photo']
                    if isinstance(photo_data, str) and photo_data.startswith('data:'):
                        try:
                            from app.s3_utils import upload_image_to_s3
                            photo_s3_path = upload_image_to_s3(photo_data, prefix="asans")
                        except Exception as e:
                            logger.error(f"Error uploading photo from import data: {e}")
                            photo_s3_path = photo_data
            except Exception as e:
                logger.error(f"Error parsing import_data: {e}")
        
        # Добавляем асану
        asana_id = add_asana(name_id=name_id, source_id=source_id, photo_path=photo_s3_path or "")
        
        # Отмечаем как решенную
        item.resolved = True
        item.resolved_by = user
        from datetime import datetime
        item.resolved_at = datetime.now().isoformat()
        
        db.commit()
        return {"message": "Запись отмечена как решенная"}
    finally:
        db.close()

@app.get("/asana/{asana_id}/photo-by-source/{source_id}")
async def get_asana_photo_by_source(asana_id: str, source_id: str):
    """
    Получить фото асаны из конкретного источника (если есть)
    """
    photo = get_photo_of_asana_from_source(asana_id, source_id)
    if photo:
        return {"photo": photo}
    return {"photo": None}

templates = Jinja2Templates(directory="frontend/app/templates")

def get_user_role_from_request(request: Request) -> str:
    """
    Получает роль пользователя из токена через server-module API.
    Если сервис недоступен, использует fallback на локальную проверку токена.
    """
    token = request.cookies.get('access_token') or request.cookies.get('session_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return 'guest'
    
    try:
        # Пробуем получить информацию о пользователе через server-module
        from app.auth import get_user_info_from_token_sync
        user_data = get_user_info_from_token_sync(token)
        if user_data:
            is_admin = user_data.get("is_admin", False)
            permission_study = user_data.get("permission_study", False)
            # Маппинг: is_admin → admin, permission_study → expert, иначе → guest
            if is_admin:
                return 'admin'
            elif permission_study:
                return 'expert'
            else:
                return 'guest'
    except Exception as e:
        logger.warning(f"Failed to get user role from auth service: {str(e)}, using fallback")
    
    # Fallback: проверяем токен локально (если в токене есть роль)
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        role = payload.get('role')
        if role:
            return role
        # Если роли нет в токене, возвращаем guest
        return 'guest'
    except JWTError:
        return 'guest'

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
    is_authenticated = user_role != 'guest'
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
            "is_authenticated": user_role != 'guest',
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
            "is_authenticated": user_role != 'guest',
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
@app.get("/api/asanas/search")
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
    # Если есть валидный токен - пользователь авторизован (включая guest)
    # guest - это авторизованный пользователь с ограниченными правами
    return {
        "is_authenticated": True,
        "role": user_role
    }