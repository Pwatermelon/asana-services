import os
import time

import uvicorn
from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.middleware.cors import CORSMiddleware

from config import get_settings
from src.api.network.router import router as network_router

app = FastAPI(title="Asana Network Service")
settings = get_settings()
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["service", "method", "path", "status"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["service", "method", "path"],
)

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


@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    HTTP_REQUESTS_TOTAL.labels("server-network", request.method, request.url.path, str(response.status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels("server-network", request.method, request.url.path).observe(elapsed)
    return response


@app.get("/", tags=["root"])
def root() -> dict:
    return {"service": "asana-network-service", "status": "ok"}


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    port = int(os.getenv("PORT_SERVER") or settings.PORT_SERVER or 8001)
    host = os.getenv("HOST_SERVER") or settings.HOST_SERVER or "0.0.0.0"
    uvicorn.run(app, host=host, port=port)
