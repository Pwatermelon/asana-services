from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    HOST: str = "0.0.0.0"
    PORT: int = 8010
    AUTH_SERVICE_URL: str = "http://server-module:8000"
    DATABASE_URL: str = (
        "postgresql+psycopg2://asana_user:asana_password@postgres:5432/asana_db"
    )
    DICT_SCHEMA: str = "dict_schema"
    REDIS_URL: str = "redis://redis:6379/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
