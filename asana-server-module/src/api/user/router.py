from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_user, get_current_admin
from src.api.request_to_admin_status.schemas import RequestToAdminStatusOutDto
from src.api.user.schemas import UserOutDto
from src.api.user.service import UserService
from src.database.config import get_session

router = APIRouter()


@router.get("/me")
async def read_users_me(
    user: UserOutDto = Depends(get_current_user),
) -> UserOutDto:
    return user


@router.patch("/me/permission_study")
async def patch_permission_study(
    permission: bool,
    user: UserOutDto = Depends(get_current_user),
    user_service: UserService = Depends(UserService),
    session: AsyncSession = Depends(get_session)
) -> UserOutDto:
    return await user_service.patch_permission_study(user, permission, session)


@router.post("/me/request_to_admin_status")
async def create_request_to_admin_status(
    user: UserOutDto = Depends(get_current_user),
    user_service: UserService = Depends(UserService),
    session: AsyncSession = Depends(get_session)
) -> RequestToAdminStatusOutDto:
    return await user_service.create_request_to_admin_status(user, session)