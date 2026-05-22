from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import HTMLResponse

from src.api.auth.schemas import Token, ResetPasswordDto, ResetPasswordRequestDto, ResetPasswordVerifyDto
from src.api.auth.service import AuthService
from src.api.auth.utils.auth_utils import get_current_admin
from src.api.user.schemas import UserOutDto, UserAuthDto, UserRegistrationDto
from src.database.config import get_session
from src.rate_limit import (
    enforce_password_reset_confirm_limit,
    enforce_password_reset_request_limit,
    enforce_password_reset_verify_limit,
)

router = APIRouter()


@router.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> Token:
    return await auth_service.auth_user(form_data.username, form_data.password, session)


@router.post("")
async def auth(
    user_data: UserAuthDto,
    response: Response,
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> Token:

    result = await auth_service.auth_user(user_data.login, user_data.password, session)
    return result


@router.get("/verify/{token}")
async def verify_mail(
    token: str,
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> None:
    _ = await auth_service.verify_token(token, session)
    return None

@router.post("/registration")
async def registration(
    user_data: UserRegistrationDto,
    _: UserOutDto = Depends(get_current_admin),
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> UserOutDto:
    return await auth_service.registration_user(user_data, session)

@router.post("/reset_password_request")
async def reset_password_request(
    request: Request,
    payload: ResetPasswordRequestDto,
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> None:
    enforce_password_reset_request_limit(request, payload.login)
    return await auth_service.reset_password_request(payload.login, session)


@router.post("/reset_password_verify")
async def reset_password_verify(
    request: Request,
    payload: ResetPasswordVerifyDto,
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session),
) -> None:
    enforce_password_reset_verify_limit(request, payload.login)
    return await auth_service.verify_reset_code(payload, session)


@router.patch("/reset_password")
async def reset_password(
    request: Request,
    reset_password_data: ResetPasswordDto,
    auth_service: AuthService = Depends(AuthService),
    session: AsyncSession = Depends(get_session)
) -> UserOutDto:
    enforce_password_reset_confirm_limit(request, reset_password_data.login)
    return await auth_service.reset_password(reset_password_data, session)