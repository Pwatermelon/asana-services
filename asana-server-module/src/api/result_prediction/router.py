from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.utils.auth_utils import get_current_user
from src.api.result_prediction.schemas import PaginationResultPredictionOutDto, ResultPredictionPutDto, \
    ResultPredictionOutDto
from src.api.result_prediction.service import ResultPredictionService
from src.api.user.schemas import UserOutDto
from src.database.config import get_session

router = APIRouter()


@router.get("")
async def get_result_predictions(
    page: int = 1,
    count: int = 5,
    only_user_predictions: bool = True,
    result_prediction_service: ResultPredictionService = Depends(ResultPredictionService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_user)
) -> PaginationResultPredictionOutDto:
    return await result_prediction_service.get_result_predictions(page, count, only_user_predictions, session, user)


@router.get("/{id_result_prediction}")
async def get_result_prediction(
    id_result_prediction: int = -1,
    result_prediction_service: ResultPredictionService = Depends(ResultPredictionService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_user)
) -> ResultPredictionOutDto:
    return await result_prediction_service.get_result_prediction(id_result_prediction, session)


@router.put("/{id_result_prediction}")
async def put_result_prediction(
    id_result_prediction: int,
    result_prediction_data: ResultPredictionPutDto,
    result_prediction_service: ResultPredictionService = Depends(ResultPredictionService),
    session: AsyncSession = Depends(get_session),
    user: UserOutDto = Depends(get_current_user)
) -> ResultPredictionOutDto:
    return await result_prediction_service.put_prediction_result(id_result_prediction, result_prediction_data, session, user)