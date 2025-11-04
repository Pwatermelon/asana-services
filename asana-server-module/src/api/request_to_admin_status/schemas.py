import math
from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from src.api.user.schemas import UserOutDto
from src.database.models import RequestToAdminStatus


class RequestToAdminStatusEnum(Enum):
    waiting: str = "В ожидании"
    rejected: str = "Отклонена"
    accept: str = "Принята"
    all: str = "Все"


class RequestToAdminStatusOutDto(BaseModel):
    id: int
    user: UserOutDto
    status: str
    created_at: str

    @classmethod
    def from_request_to_admin_status(cls, request_to_admin_status: RequestToAdminStatus) -> "RequestToAdminStatusDto":
        return RequestToAdminStatusOutDto(
            id=request_to_admin_status.id,
            user=UserOutDto.from_user(request_to_admin_status.user),
            status=request_to_admin_status.status,
            created_at=str(request_to_admin_status.created_at)
        )


class PaginationRequestToAdminStatusOutDto(BaseModel):
    page: int
    all_pages: int
    requests: list[RequestToAdminStatusOutDto]

    @staticmethod
    def from_data(requests: list[RequestToAdminStatus], count_items: int, count: int, page: int) -> "PaginationRequestToAdminStatusOutDto":
        return PaginationRequestToAdminStatusOutDto(
            page=page,
            all_pages=math.ceil(count_items / count),
            requests=[RequestToAdminStatusOutDto.from_request_to_admin_status(request) for request in requests]
        )