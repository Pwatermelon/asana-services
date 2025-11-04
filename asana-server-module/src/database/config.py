from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

from config import get_settings

settings = get_settings()

async_engine = create_async_engine(settings.get_database_url("postgresql+asyncpg"), echo=False, future=True)
sync_engine = create_engine(settings.get_database_url("postgresql"), echo=False, future=True)

Base = declarative_base()
async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()