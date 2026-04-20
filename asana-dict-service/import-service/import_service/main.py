"""
Отдельное приложение FastAPI: импорт/экспорт Excel, онтология, экспорт модерации.
Запуск: uvicorn import_service.main:app
Общий код каталога — пакет app (../backend/app в репозитории, монтируется/копируется в образ).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app import config
from app.auth import get_user_info_from_token_sync
from app.config import logger
from import_service.routes import router as import_router

app = FastAPI(
    title=f"{config.APP_NAME} — import/export",
    description="Импорт и экспорт данных каталога (Excel, онтология)",
    version=config.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


class DocsAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        protected_paths = ["/docs", "/redoc", "/openapi.json"]
        is_protected = any(
            path == protected or path.startswith(protected + "/") for protected in protected_paths
        )
        if is_protected:
            token = (
                request.headers.get("Authorization", "").replace("Bearer ", "")
                or request.cookies.get("access_token")
                or request.cookies.get("session_token")
            )
            if not token:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Требуется авторизация для доступа к документации API"},
                )
            try:
                user_data = get_user_info_from_token_sync(token)
                if not user_data:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Недействительный токен авторизации"},
                    )
                is_admin_flag = user_data.get("is_admin", False)
                permission_study = user_data.get("permission_study", False)
                if not (is_admin_flag or permission_study):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "Доступ к документации API разрешен только администраторам и экспертам"
                        },
                    )
            except Exception as e:
                logger.error("Error checking auth in docs middleware: %s", e)
                return JSONResponse(status_code=401, content={"detail": "Ошибка проверки авторизации"})
        response = await call_next(request)
        return response


app.add_middleware(DocsAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_router)


@app.on_event("startup")
async def startup_event():
    from app.main import run_application_startup

    run_application_startup()
