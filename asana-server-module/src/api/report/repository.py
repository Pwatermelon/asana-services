from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.api.report.schemas import ReportCreateDto
from src.database.models import Report


class ReportRepository:
    async def create_report(self, id_user: Optional[int], report_create: ReportCreateDto, session: AsyncSession) -> Report:
        report: Report = Report(
            id_user=id_user,
            text=report_create.text
        )
        session.add(report)
        await session.commit()
        await session.flush()
        return report