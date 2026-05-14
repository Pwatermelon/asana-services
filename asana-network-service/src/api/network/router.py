from fastapi import APIRouter, Depends

from src.api.network.schemas import (
    PredictIn,
    PredictOut,
    ScanIn,
    ScanOut,
)
from src.api.network.service import NetworkService

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/predict")
def predict(
    image: PredictIn,
    network_service: NetworkService = Depends(NetworkService),
) -> PredictOut:
    return network_service.predict(image)


@router.post("/scan-duplicates")
def scan_duplicates(
    payload: ScanIn,
    network_service: NetworkService = Depends(NetworkService),
) -> ScanOut:
    """
    Пакетный поиск похожих фото между разными асанами.
    Используется asana-dict-service для постановки кандидатов на связь
    isSameAsObject в очередь модерации.
    """
    return network_service.scan_duplicates(payload)
