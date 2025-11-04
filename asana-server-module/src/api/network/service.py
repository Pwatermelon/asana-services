import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from src.api.network.schemas import PredictIn, PredictOut
from src.api.network.utils import send_request_to_network
from src.api.result_prediction.service import ResultPredictionService
from src.api.user.schemas import UserOutDto
from src.api.yoga_pose.service import YogaPoseService
from src.utils.add_image_minio import add_image_minio


class NetworkService:
    def __init__(self):
        self.yoga_pose_service = YogaPoseService()
        self.result_prediction_service = ResultPredictionService()

    async def prediction(self, prediction_date: PredictIn, user: UserOutDto, permission_study: bool, session: AsyncSession) -> PredictOut:
        id_poses = await send_request_to_network(prediction_date)
        poses = []
        for id_pose in id_poses:
            poses.append(await self.yoga_pose_service.get_yoga_pose_by_id(id_pose, session))

        prediction_date.image = await add_image_minio(prediction_date.image)

        if user is not None and user.permission_study:
            result_prediction = await self.result_prediction_service.create_result_prediction(prediction_date, id_poses, user, session)
            return PredictOut(result_prediction_id=result_prediction.id, yoga_poses=poses)
        elif user is not None and not user.permission_study:
            return PredictOut(result_prediction_id=None, yoga_poses=poses)
        elif permission_study:
            result_prediction = await self.result_prediction_service.create_result_prediction(prediction_date, id_poses, None, session)
            return PredictOut(result_prediction_id=result_prediction.id, yoga_poses=poses)

        return PredictOut(result_prediction_id=None, yoga_poses=poses)