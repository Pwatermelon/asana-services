import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from src.api.network.router import router as network_router
from config import get_settings

app = FastAPI()
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network_router, prefix="/network", tags=["Нейронная сеть"])


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(settings.PORT_SERVER))