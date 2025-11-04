from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from fastapi import Request, Depends
from typing import Optional

from config import get_settings

settings = get_settings()

async_engine = create_async_engine(settings.get_database_url("postgresql+asyncpg"), echo=False, future=True)
sync_engine = create_engine(settings.get_database_url("postgresql"), echo=False, future=True)

Base = declarative_base()
async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


def get_schema_from_request(request: Request) -> str:
    """Получает схему БД из заголовка запроса или использует 'public' по умолчанию"""
    schema = request.headers.get("X-DB-Schema", "public")
    # Валидация схемы
    if schema not in ["public", "dict_schema"]:
        schema = "public"
    return schema


async def get_session(request: Request) -> AsyncSession:
    """Создает сессию с динамической схемой из заголовка запроса"""
    schema = get_schema_from_request(request)
    async with async_session() as session:
        try:
            # Устанавливаем search_path для текущей сессии
            await session.execute(text(f"SET search_path TO {schema}, public"))
            await session.commit()
            yield session
        finally:
            await session.close()