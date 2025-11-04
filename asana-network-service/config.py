import os
from functools import lru_cache
from typing import Any

from pydantic.v1 import BaseSettings
from dotenv import find_dotenv


class Settings(BaseSettings):
    HOST_SERVER: str
    PORT_SERVER: str

    def __init__(self, **values: Any):
        super().__init__(**values)
        for attribute, value in self.__dict__.items():
            self.__dict__[attribute] = os.getenv(attribute, value)

    class Config:
        env_file = find_dotenv(".env")


@lru_cache()
def get_settings():
    return Settings()