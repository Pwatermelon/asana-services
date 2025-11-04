from sqlalchemy.ext.asyncio import AsyncSession

from src.api.request_to_admin_status.repository import RequestToAdminStatusRepository
from src.api.request_to_admin_status.schemas import RequestToAdminStatusOutDto, PaginationRequestToAdminStatusOutDto, \
    RequestToAdminStatusEnum
from src.api.result_prediction.schemas import PaginationResultPredictionOutDto
from src.api.user.schemas import UserOutDto


class RequestToAdminStatusService:
    def __init__(self):
        self.request_to_admin_status_repository = RequestToAdminStatusRepository()

    async def create_request_to_admin_status(self, user: UserOutDto, session: AsyncSession) -> RequestToAdminStatusOutDto:
        request_to_admin_status = await self.request_to_admin_status_repository.create_request_to_admin_status(user.id, session)
        request_to_admin_status_full  = await self.request_to_admin_status_repository.get_request_to_admin_status_by_id(request_to_admin_status.id, session)
        return RequestToAdminStatusOutDto.from_request_to_admin_status(request_to_admin_status_full)

    async def get_requests_to_admin_status(self, page: int, count: int, needed_status: RequestToAdminStatusEnum, session: AsyncSession) -> PaginationRequestToAdminStatusOutDto:
        requests, total_count = await self.request_to_admin_status_repository.get_requests_to_admin_status(page, count, needed_status, session)
        return PaginationRequestToAdminStatusOutDto.from_data(requests, total_count, count, page)

    async def patch_request_to_admin_status_by_id(self, id_request: int, status: RequestToAdminStatusEnum, session: AsyncSession) -> RequestToAdminStatusOutDto:
        request = await self.request_to_admin_status_repository.patch_request_to_admin_status_by_id(id_request, status, session)
        return RequestToAdminStatusOutDto.from_request_to_admin_status(request)