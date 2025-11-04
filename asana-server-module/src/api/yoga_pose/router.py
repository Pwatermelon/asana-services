from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_admin
from src.api.user.schemas import UserOutDto
from src.api.yoga_pose.schemas import YogaPoseOutDto, PaginationYogaPoseOutDto, YogaPosePutDto, YogaPosePatchImagesDto
from src.api.yoga_pose.service import YogaPoseService
from src.database.config import get_session

router = APIRouter()


@router.get("")
async def get_yoga_poses(
    page: int = 1,
    count: int = 5,
    text: str = "",
    yoga_pose_service: YogaPoseService = Depends(YogaPoseService),
    session: AsyncSession = Depends(get_session)
) -> PaginationYogaPoseOutDto:
    return await yoga_pose_service.get_yoga_poses(page, count, text, session)


@router.get("/{id_yoga_pose}")
async def get_yoga_pose_by_id(
    id_yoga_pose: int,
    yoga_pose_service: YogaPoseService = Depends(YogaPoseService),
    session: AsyncSession = Depends(get_session)
) -> YogaPoseOutDto:
    return await yoga_pose_service.get_yoga_pose_by_id(id_yoga_pose, session)


@router.put("/{id_yoga_pose}")
async def put_yoga_pose_by_id(
    id_yoga_pose: int,
    yoga_pose_data: YogaPosePutDto,
    yoga_pose_service: YogaPoseService = Depends(YogaPoseService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_admin)
):
    return await yoga_pose_service.put_yoga_pose_by_id(id_yoga_pose, yoga_pose_data, session)


@router.patch("/{id_yoga_pose}/images")
async def patch_images_yoga_pose_by_id(
    id_yoga_pose: int,
    images_data: YogaPosePatchImagesDto,
    yoga_pose_service: YogaPoseService = Depends(YogaPoseService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_admin)
):
    return await yoga_pose_service.patch_images_pose_by_id(id_yoga_pose, images_data, session)


@router.delete("/{id_yoga_pose}/images")
async def delete_images_yoga_pose_by_id(
    id_yoga_pose: int,
    image_id: int,
    yoga_pose_service: YogaPoseService = Depends(YogaPoseService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_admin)
):
    return await yoga_pose_service.delete_images_pose_by_id(id_yoga_pose, image_id, session)