from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from src.database.models import Report


class ReportCreateDto(BaseModel):
    text: str

class ReportOutDto(BaseModel):
    id: int
    id_user: Optional[int]
    text: str
    created_at: str

    @classmethod
    def from_report(cls, report: Report) -> "ReportOutDto":
        return ReportOutDto(
            id=report.id,
            id_user=report.id_user,
            text=report.text,
            created_at=str(report.created_at)
        )