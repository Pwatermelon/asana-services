from fastapi import HTTPException
from starlette import status


class CredentialsException(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Ошибка в данных для авторизации")

class CredentialsExceptionNotFound(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Логин или почта не существует")


class CredentialsExceptionPassword(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Неправильный пароль")

class LoginExistsException(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_409_CONFLICT, "Пользователь с таким логином уже существует")

class MailExistsException(HTTPException):
    def __init__(self):
        super().__init__(status.HTTP_409_CONFLICT, "Пользователь с такой почтой уже существует")