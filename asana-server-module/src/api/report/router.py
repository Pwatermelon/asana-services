from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_user_soft
from src.api.report.schemas import ReportCreateDto
from src.api.report.service import ReportService
from src.api.user.schemas import UserOutDto
from src.database.config import get_session
from src.database.models import Report

router = APIRouter()


@router.post("")
async def create_report(
    report_data: ReportCreateDto,
    user: UserOutDto = Depends(get_current_user_soft),
    session: AsyncSession = Depends(get_session),
    service: ReportService = Depends(ReportService)
):
    return await service.create_report(user, report_data, session)