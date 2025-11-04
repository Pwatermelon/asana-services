from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from src.api.auth.utils.auth_utils import get_current_admin
from src.api.rept.service import ReptService
from src.api.user.schemas import UserOutDto
from src.database.config import get_session

router = APIRouter()

@router.get("/general")
def get_rept_general(
    begin_date: datetime,
    end_date: datetime,
    rept_service: ReptService = Depends(ReptService),
    user: UserOutDto = Depends(get_current_admin),
):
    stream = rept_service.get_rept_general(begin_date, end_date)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="report_general.xlsx"'
        }
    )