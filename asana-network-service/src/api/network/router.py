from fastapi import APIRouter, Depends

from src.api.network.schemas import PredictIn, PredictOut
from src.api.network.service import NetworkService

router = APIRouter()


@router.post("/predict")
def predict(image: PredictIn, network_service: NetworkService = Depends(NetworkService)) -> PredictOut:
    answer = network_service.predict(image)
    return answer