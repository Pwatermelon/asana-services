from fastapi import APIRouter, Depends
from prometheus_client import Counter

from src.api.network.schemas import (
    PredictIn,
    PredictOut,
    ScanIn,
    ScanOut,
)
from src.api.network.service import NetworkService

router = APIRouter()
NETWORK_REQUESTS_TOTAL = Counter(
    "network_service_requests_total",
    "Requests to AI endpoints",
    ["endpoint"],
)


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/predict")
def predict(
    image: PredictIn,
    network_service: NetworkService = Depends(NetworkService),
) -> PredictOut:
    NETWORK_REQUESTS_TOTAL.labels("predict").inc()
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
    NETWORK_REQUESTS_TOTAL.labels("scan_duplicates").inc()
    return network_service.scan_duplicates(payload)
