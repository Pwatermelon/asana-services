import aiohttp

from config import get_settings
from src.api.network.schemas import PredictIn, PredictOut

settings = get_settings()


async def send_request_to_network(prediction_date: PredictIn) -> list[int]:
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{settings.HOST_NETWORK_SERVER}/network/predict", json=prediction_date.dict()) as response:
            result = await response.json()
            return result["classes"]