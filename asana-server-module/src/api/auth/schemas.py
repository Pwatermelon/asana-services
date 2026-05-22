from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from fastapi import Request


class NonExceptionOAuth2PasswordBearer(OAuth2PasswordBearer):
    async def __call__(self, request: Request) -> str | None:
        authorization: str | None = request.headers.get("Authorization")
        if authorization:
            return await super().__call__(request)
        return None


class Token(BaseModel):
    access_token: str
    token_type: str


class ResetPasswordDto(BaseModel):
    login: str
    code: str
    password: str


class ResetPasswordRequestDto(BaseModel):
    login: str


class ResetPasswordVerifyDto(BaseModel):
    login: str
    code: str
