from __future__ import annotations

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum
from typing import Optional

Base = declarative_base()

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

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default=UserRole.GUEST)
    is_confirmed = Column(Boolean, default=False)
    confirmation_code = Column(String, nullable=True)

class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    first_name: str
    last_name: str
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
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)

class ExpertInstructions(Base):
    __tablename__ = "expert_instructions"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
