from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_admin
from src.api.request_to_admin_status.schemas import PaginationRequestToAdminStatusOutDto, RequestToAdminStatusEnum, \
    RequestToAdminStatusOutDto
from src.api.request_to_admin_status.service import RequestToAdminStatusService
from src.api.result_prediction.schemas import PaginationResultPredictionOutDto
from src.api.user.schemas import UserOutDto
from src.database.config import get_session
from src.database.models import RequestToAdminStatus

router = APIRouter()

@router.get("")
async def get_requests_to_admin_status(
    page: int = 1,
    count: int = 10,
    needed_status: RequestToAdminStatusEnum = RequestToAdminStatusEnum.all,
    request_to_admin_status_service: RequestToAdminStatusService = Depends(RequestToAdminStatusService),
    user: UserOutDto = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> PaginationRequestToAdminStatusOutDto:
    return await request_to_admin_status_service.get_requests_to_admin_status(page, count, needed_status, session)

@router.patch("/{id_request}")
async def patch_request_to_admin_status_by_id(
    id_request: int,
    status: RequestToAdminStatusEnum,
    request_to_admin_status_service: RequestToAdminStatusService = Depends(RequestToAdminStatusService),
    user: UserOutDto = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
) -> RequestToAdminStatusOutDto:
    return await request_to_admin_status_service.patch_request_to_admin_status_by_id(id_request, status, session)