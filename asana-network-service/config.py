import os
from functools import lru_cache
from typing import Any

from dotenv import find_dotenv
from pydantic.v1 import BaseSettings


class Settings(BaseSettings):
    HOST_SERVER: str = "0.0.0.0"
    PORT_SERVER: str = "8001"

    def __init__(self, **values: Any):
        super().__init__(**values)
        for attribute, value in self.__dict__.items():
            self.__dict__[attribute] = os.getenv(attribute, value)

    class Config:
        env_file = find_dotenv(".env")


@lru_cache()
def get_settings():
    return Settings()
