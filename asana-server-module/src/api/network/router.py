from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_user, get_current_user_soft
from src.api.network.schemas import PredictIn, PredictOut
from src.api.network.service import NetworkService
from src.api.user.schemas import UserOutDto
from src.database.config import get_session

router = APIRouter()


@router.post("/prediction")
async def prediction(
    prediction_date: PredictIn,
    request: Request,
    network_service: NetworkService = Depends(NetworkService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_user_soft)
) -> PredictOut:
    permission = prediction_date.permission_study if prediction_date.permission_study is not None else False
    return await network_service.prediction(prediction_date, user, permission, session)