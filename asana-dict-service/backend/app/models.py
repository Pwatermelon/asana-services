from __future__ import annotations

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, Boolean, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum
from typing import Optional

# Используем отдельную схему для asana-dict-service
Base = declarative_base()

# Схема для таблиц asana-dict-service
DICT_SCHEMA = "dict_schema"

class UserRole(str, Enum):
    ADMIN = "admin"
    EXPERT = "expert"
    GUEST = "guest"

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TokenData(BaseModel):
    username: str | None = None
    role: str | None = None

# Таблица users для server-module в схеме dict_schema
# Структура соответствует модели User из server-module
class User(Base):
    __tablename__ = "users"
    __table_args__ = {'schema': DICT_SCHEMA}
    id = Column(Integer, primary_key=True, autoincrement=True)
    login = Column(String(256), unique=True, nullable=False, index=True)
    mail = Column(String(256), unique=True, nullable=False, index=True)
    password = Column(String(256), nullable=False)  # Хеш пароля
    is_admin = Column(Boolean, default=False)
    permission_study = Column(Boolean, default=False)
    is_verify = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(1024), nullable=True)

class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    code: str
    new_password: str

class AsanaName(BaseModel):
    name_ru: str
    name_sanskrit: Optional[str] = None
    transliteration: Optional[str] = None
    definition: Optional[str] = None

class AsanaSource(BaseModel):
    author: str
    title: str
    year: int
    publisher: Optional[str] = None
    pages: Optional[int] = None
    annotation: Optional[str] = None

class AboutProject(Base):
    __tablename__ = "about_project"
    __table_args__ = {'schema': DICT_SCHEMA}
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)

class ExpertInstructions(Base):
    __tablename__ = "expert_instructions"
    __table_args__ = {'schema': DICT_SCHEMA}
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)

class ModerationItem(Base):
    __tablename__ = "moderation_items"
    __table_args__ = {'schema': DICT_SCHEMA}
    id = Column(Integer, primary_key=True, index=True)
    asana_name = Column(String(500), nullable=False)  # Название асаны из импорта
    source_id = Column(String(500), nullable=True)  # ID источника
    error_message = Column(String, nullable=False)  # Сообщение об ошибке
    row_number = Column(Integer, nullable=False)  # Номер строки в Excel
    import_data = Column(String, nullable=True)  # JSON с данными импорта
    created_at = Column(String, nullable=False)  # Дата создания
    resolved = Column(Boolean, default=False)  # Решена ли проблема
    resolved_by = Column(String(256), nullable=True)  # Кто решил
    resolved_at = Column(String, nullable=True)  # Когда решена
    # Поля для модерации названий асан
    suggested_name_ru = Column(String(500), nullable=True)  # Предложенное название на русском
    suggested_name_sanskrit = Column(String(500), nullable=True)  # Предложенное название на санскрите
    suggested_transliteration = Column(String(500), nullable=True)  # Предложенная транслитерация
    suggested_definition = Column(String, nullable=True)  # Предложенное определение
    existing_name_id = Column(String(500), nullable=True)  # ID существующего названия (если найдено неполное совпадение)
    existing_name_ru = Column(String(500), nullable=True)  # Существующее название на русском
    moderation_type = Column(String(50), nullable=True)  # Тип модерации: 'error' или 'name_mismatch'
    object_type = Column(String(50), nullable=True)  # Тип объекта: 'asana_name', 'source', 'asana'


class CatalogSyncState(Base):
    """
    Одна строка id=1: учёт активных операций записи в OWL и метаданные синхронизации OWL→PostgreSQL.
    Пока write_lease_count > 0 — фоновая синхронизация зеркала каталога в БД не выполняется.
    """

    __tablename__ = "catalog_sync_state"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True)
    write_lease_count = Column(Integer, nullable=False, default=0)
    last_owl_to_db_at = Column(String(64), nullable=True)
    last_owl_sha256 = Column(String(64), nullable=True)


class CatalogMirrorItem(Base):
    """Зеркало сущностей каталога из OWL (JSON) для запросов и будущего DB-first режима."""

    __tablename__ = "catalog_mirror_items"
    __table_args__ = {"schema": DICT_SCHEMA}

    uri = Column(String(2048), primary_key=True)
    entity_type = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, nullable=False)


class AsanaNameMeta(Base):
    """Метаданные названия асаны вне OWL (дата создания, пакет импорта)."""

    __tablename__ = "asana_name_meta"
    __table_args__ = {"schema": DICT_SCHEMA}

    uri = Column(String(2048), primary_key=True)
    created_at = Column(String(64), nullable=False)
    import_batch_id = Column(Integer, nullable=True, index=True)


class NameImportBatch(Base):
    """Один запуск импорта названий из Excel."""

    __tablename__ = "name_import_batches"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(String(64), nullable=False)
    user = Column(String(256), nullable=True)
    imported_count = Column(Integer, nullable=False, default=0)


class ImportBatch(Base):
    """
    Пакет импорта из Excel: сначала строки пишутся в staging без блокировки OWL,
    затем один воркер применяет их к онтологии под lock.
    """

    __tablename__ = "import_batches"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user = Column(String(256), nullable=False)
    mode = Column(String(32), nullable=False)  # asanas | full | names
    source_id = Column(String(512), nullable=True)
    source_mapping = Column(JSON, nullable=True)
    status = Column(String(32), nullable=False, default="staged")
    total_rows = Column(Integer, nullable=False, default=0)
    created_at = Column(String(64), nullable=False)


class ImportStagingRow(Base):
    """Одна строка Excel (нормализованный payload) до применения к OWL."""

    __tablename__ = "import_staging_rows"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    payload = Column(JSON, nullable=False)


class AISimilarityProposal(Base):
    """
    Предложение от ИИ-модуля (asana-network-service) на установку связи
    isSameAsObject между двумя асанами на основании совпадения фото или
    совпадения предсказанного класса позы (yoga-82). Модерируется экспертом
    или администратором: «Подтвердить» вызывает add_same_as_object,
    «Отклонить» помечает предложение как обработанное.
    """

    __tablename__ = "ai_similarity_proposals"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    asana_a_id = Column(String(2048), nullable=False, index=True)
    asana_b_id = Column(String(2048), nullable=False, index=True)
    photo_a_id = Column(String(2048), nullable=True)
    photo_b_id = Column(String(2048), nullable=True)
    score = Column(Float, nullable=False, default=0.0)
    reason = Column(String(64), nullable=False)  # phash_exact | yoga_class
    detail = Column(String(512), nullable=True)
    status = Column(String(32), nullable=False, default="pending")  # pending|confirmed|rejected
    created_at = Column(String(64), nullable=False)
    reviewed_at = Column(String(64), nullable=True)
    reviewed_by = Column(String(256), nullable=True)
    """SHA-256 от (asana_a, asana_b, reason). Защищает от повторной вставки одной и той же пары."""
    pair_key = Column(String(64), nullable=False, unique=True, index=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = {"schema": DICT_SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(String(64), nullable=False, index=True)
    login = Column(String(256), nullable=True, index=True)
    avatar_url = Column(String(1024), nullable=True)
    method = Column(String(16), nullable=False, index=True)
    path = Column(String(1024), nullable=False)
    status_code = Column(Integer, nullable=False, index=True)
    action_code = Column(String(128), nullable=False, index=True)
    entity_type = Column(String(64), nullable=True, index=True)
    entity_id = Column(String(256), nullable=True)
    ip = Column(String(128), nullable=True)
    details = Column(String, nullable=True)
