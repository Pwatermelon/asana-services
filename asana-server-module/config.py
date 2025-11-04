import os
from functools import lru_cache
from typing import Any

from pydantic.v1 import BaseSettings
from dotenv import find_dotenv


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
    SMTP_PORT: str
    SMTP_USER: str
    SMTP_PASSWORD: str

    HOST_MINIO: str
    PORT_MINIO: str
    USER_MINIO: str
    PASSWORD_MINIO: str
    NAME_BUCKET_IMAGES_MINIO: str

    def __init__(self, **values: Any):
        super().__init__(**values)
        for attribute, value in self.__dict__.items():
            self.__dict__[attribute] = os.getenv(attribute, value)

    def get_database_url(self, driver) -> str:
        return f"{driver}://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = find_dotenv(".env")


@lru_cache()
def get_settings():
    return Settings()