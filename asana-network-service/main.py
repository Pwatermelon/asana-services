import os

import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config import get_settings
from src.api.network.router import router as network_router

app = FastAPI(title="Asana Network Service")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network_router, prefix="/network", tags=["Нейронная сеть"])
# Дублируем под /ai — удобно для интеграции с dict-service (см. config.NETWORK_SERVICE_URL).
app.include_router(network_router, prefix="/ai", tags=["AI"])


@app.get("/", tags=["root"])
def root() -> dict:
    return {"service": "asana-network-service", "status": "ok"}


if __name__ == "__main__":
    port = int(os.getenv("PORT_SERVER") or settings.PORT_SERVER or 8001)
    host = os.getenv("HOST_SERVER") or settings.HOST_SERVER or "0.0.0.0"
    uvicorn.run(app, host=host, port=port)
