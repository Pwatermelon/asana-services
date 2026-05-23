from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
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
    mail: EmailStr
    code: str
    password: str


class ResetPasswordRequestDto(BaseModel):
    mail: EmailStr


class ResetPasswordVerifyDto(BaseModel):
    mail: EmailStr
    code: str
