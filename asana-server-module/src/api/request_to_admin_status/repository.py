from typing import Tuple, List

import loguru
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.auth.exceptions import CredentialsException
from src.api.request_to_admin_status.exceptions import BadRequestException
from src.api.request_to_admin_status.schemas import RequestToAdminStatusEnum
from src.database.models import RequestToAdminStatus, User


class RequestToAdminStatusRepository:
    async def create_request_to_admin_status(self, user_id: int, session: AsyncSession) -> RequestToAdminStatus:
        request = RequestToAdminStatus(
            id_user=user_id,
            status=RequestToAdminStatusEnum.waiting.value,
        )
        session.add(request)
        await session.commit()
        await session.flush()
        return request

    async def get_requests_to_admin_status(self, page: int, count: int, needed_status: RequestToAdminStatusEnum, session: AsyncSession) -> Tuple[List[RequestToAdminStatus], int]:
        base_query = select(RequestToAdminStatus).options(selectinload(RequestToAdminStatus.user))
        base_query_count = select(func.count(RequestToAdminStatus.id))
        if needed_status != RequestToAdminStatusEnum.all:
            base_query = base_query.where(RequestToAdminStatus.status == needed_status.value)
            base_query_count = base_query_count.where(RequestToAdminStatus.status == needed_status.value)

        requests = (await session.execute(
            base_query
            .order_by(desc(RequestToAdminStatus.created_at))
            .offset((page - 1) * count).limit(count)
        )).scalars().all()
        count_requests = (await session.execute(
            base_query_count
        )).scalar()

        return list(requests), count_requests

    async def get_request_to_admin_status_by_id(self, id_request: int, session: AsyncSession) -> RequestToAdminStatus:
        request_to_admin_status = (await session.execute(
            select(RequestToAdminStatus).options(selectinload(RequestToAdminStatus.user)).where(RequestToAdminStatus.id == id_request)
        )).scalar_one_or_none()
        return request_to_admin_status

    async def patch_request_to_admin_status_by_id(self, id_request: int, status: RequestToAdminStatusEnum, session: AsyncSession):
        request = (await session.execute(
            select(RequestToAdminStatus).options(selectinload(RequestToAdminStatus.user)).where(RequestToAdminStatus.id == id_request)
        )).scalar_one_or_none()
        if request.status != RequestToAdminStatusEnum.waiting.value:
            raise BadRequestException()

        request.status = status.value
        session.add(request)

        if status == RequestToAdminStatusEnum.accept:
            user = (await session.execute(
                select(User).where(
                    User.id == request.id_user)
            )).scalar_one_or_none()

            user.is_admin = True
            session.add(user)

        await session.commit()
        await session.flush()

        return request