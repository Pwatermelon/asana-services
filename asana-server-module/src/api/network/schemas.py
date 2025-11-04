from typing import Optional

from pydantic import BaseModel

from src.api.yoga_pose.schemas import YogaPoseOutDto
from src.database.models import YogaPose


class PredictIn(BaseModel):
    image: str
    permission_study: Optional[bool]


class PredictOut(BaseModel):
    result_prediction_id: Optional[int]
    yoga_poses: list[YogaPoseOutDto]