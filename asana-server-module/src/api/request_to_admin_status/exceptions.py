from fastapi import HTTPException
from starlette import status


class BadRequestException(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_409_CONFLICT, "Ошибка со стороны клиента в параметрах запроса")