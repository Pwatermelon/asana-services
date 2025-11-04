from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.api.report.repository import ReportRepository
from src.api.report.schemas import ReportCreateDto, ReportOutDto
from src.database.models import User


class ReportService:
    def __init__(self):
        self.report_repository = ReportRepository()

    async def create_report(self, user: Optional[User], report_create: ReportCreateDto, session: AsyncSession) -> ReportOutDto:
        report = await self.report_repository.create_report(user.id if user else None, report_create, session)
        return ReportOutDto.from_report(report)