import os
from functools import lru_cache
from typing import Any

from pydantic.v1 import BaseSettings
from dotenv import find_dotenv

from src.api.auth.utils.smtp_env import smtp_host, smtp_port


class Settings(BaseSettings):
    DB_HOST: str
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_PORT: str

    HOST_SERVER: str
    PORT_SERVER: str
    SECRET_KEY: str

    HOST_NETWORK_SERVER: str

    SMTP_SERVER: str
    SMTP_PORT: str = "587"
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM: str = ""

    HOST_MINIO: str
    PORT_MINIO: str
    USER_MINIO: str
    PASSWORD_MINIO: str
    NAME_BUCKET_IMAGES_MINIO: str
    MINIO_URL_PREFIX: str = "http://localhost/images"

    PASSWORD_RESET_OTP_TTL_MINUTES: str = "15"

    def __init__(self, **values: Any):
        super().__init__(**values)
        for attribute, value in self.__dict__.items():
            self.__dict__[attribute] = os.getenv(attribute, value)
        self.__dict__["SMTP_SERVER"] = smtp_host()
        self.__dict__["SMTP_PORT"] = str(smtp_port(465))
        if not (self.__dict__.get("SMTP_FROM") or "").strip():
            self.__dict__["SMTP_FROM"] = self.__dict__.get("SMTP_USER") or ""

    def get_database_url(self, driver) -> str:
        return f"{driver}://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = find_dotenv(".env")


@lru_cache()
def get_settings():
    return Settings()