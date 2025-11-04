from __future__ import annotations

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, Boolean
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
