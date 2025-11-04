from fastapi import HTTPException
from starlette import status


class ForbiddenException(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_403_FORBIDDEN, "Пользователь не обладает правами")