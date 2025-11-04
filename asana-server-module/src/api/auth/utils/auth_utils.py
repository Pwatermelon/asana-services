from datetime import timedelta, datetime, timezone
from typing import Annotated

import jwt
from itsdangerous import URLSafeTimedSerializer
from fastapi import Depends, Request
from jwt import InvalidTokenError

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from src.api.auth.exceptions import CredentialsException, CredentialsExceptionNotFound, CredentialsExceptionPassword
from src.api.auth.schemas import NonExceptionOAuth2PasswordBearer
from src.api.user.schemas import UserOutDto
from src.api.user.service import UserService
from src.database.config import get_session

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = NonExceptionOAuth2PasswordBearer(tokenUrl="/api/auth/token")
user_service = UserService()
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)

def verify_password(plain_password, hashed_password) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password) -> str:
    return pwd_context.hash(password)


async def authenticate_user(login: str, password: str, session: AsyncSession) -> UserOutDto | None:
    user: UserOutDto = await user_service.get_user_by_login(login, session)
    if not user:
        user: UserOutDto = await user_service.get_user_by_mail(login, session)
        if not user:
            raise CredentialsExceptionNotFound()

    if not verify_password(password, user.password):
        raise CredentialsExceptionPassword()

    return user


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=1 * 60 * 24 * 7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


async def get_current_user(
        token: Annotated[str, Depends(oauth2_scheme)],
        request: Request,
        session: AsyncSession = Depends(get_session)
) -> UserOutDto:
    try:
        if not token:
            token = request.cookies.get("access_token")
            if not token:
                raise CredentialsException()

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        login: str = payload.get("login")
        if login is None:
            raise CredentialsException()
    except InvalidTokenError:
        raise CredentialsException()

    user = await user_service.get_user_by_login(login, session)
    if user is None:
        raise CredentialsException()
    return user


async def get_current_user_soft(
        token: Annotated[str, Depends(oauth2_scheme)],
        request: Request,
        session: AsyncSession = Depends(get_session)
) -> UserOutDto | None:
    try:
        user: UserOutDto = await get_current_user(token, request, session)
        return user
    except:
        return None


async def get_current_admin(
        token: Annotated[str, Depends(oauth2_scheme)],
        request: Request,
        session: AsyncSession = Depends(get_session)
) -> UserOutDto:
    user: UserOutDto = await get_current_user(token, request, session)
    if user.is_admin:
        return user
    else:
        raise CredentialsException()


