import json

from sqlalchemy.ext.asyncio import AsyncSession

from src.api.network.schemas import PredictIn
from src.api.result_prediction.repository import ResultPredictionRepository
from src.api.result_prediction.schemas import PaginationResultPredictionOutDto, ResultPredictionPutDto, \
    ResultPredictionOutDto
from src.api.user.schemas import UserOutDto
from src.api.yoga_pose.service import YogaPoseService
from src.database.models import ResultPrediction


class ResultPredictionService:
    def __init__(self):
        self.yoga_pose_service = YogaPoseService()
        self.result_prediction_repository = ResultPredictionRepository()

    async def create_result_prediction(self, prediction_date: PredictIn, id_poses: list[int], user: UserOutDto | None, session: AsyncSession) -> ResultPrediction:
        id_poses_json = json.dumps(id_poses)
        user_id = user.id if user is not None else None
        return await self.result_prediction_repository.create_result_prediction(prediction_date.image, id_poses_json, user_id, session)

    async def get_result_prediction(self, id_result_prediction: int, session: AsyncSession) -> ResultPredictionOutDto:
        result_prediction = await self.result_prediction_repository.get_result_prediction_by_id(id_result_prediction, session)
        answer = json.loads(result_prediction.answer)
        answer_poses = await self.yoga_pose_service.get_yoga_pose_by_ids(answer, session)
        answer_poses_filtered = []

        for answer_item in answer:
            answer_poses_filtered.append(list(filter(lambda x: x.id == answer_item, answer_poses))[0])

        return ResultPredictionOutDto.from_result_prediction(result_prediction, answer_poses_filtered)

    async def get_result_predictions(self, page: int, count: int, only_user_predictions: bool, session: AsyncSession, user: UserOutDto) -> PaginationResultPredictionOutDto:
        if user.is_admin:
            result_predictions, count_predictions = await self.result_prediction_repository.get_result_predictions(page, count, session, only_user_predictions, user.id)
        else:
            result_predictions, count_predictions = await self.result_prediction_repository.get_result_predictions(page, count, session, True, user.id)

        result_predictions_all_data = []
        for result_prediction in result_predictions:
            answer = json.loads(result_prediction.answer)
            answer_poses = await self.yoga_pose_service.get_yoga_pose_by_ids(answer, session)
            answer_poses_filtered = []

            for answer_item in answer:
                answer_poses_filtered.append(list(filter(lambda x: x.id == answer_item, answer_poses))[0])

            result_predictions_all_data.append(
                (result_prediction, answer_poses_filtered)
            )

        return PaginationResultPredictionOutDto.from_data(
            result_predictions_all_data, count_predictions, count, page
        )

    async def put_prediction_result(self, id_result_prediction: int, result_prediction_data: ResultPredictionPutDto, session: AsyncSession, user: UserOutDto):
        result_prediction = await self.result_prediction_repository.put_result_prediction(id_result_prediction, result_prediction_data, session)
        return await self.get_result_prediction(id_result_prediction, session)