import asyncio
import os
import fcntl
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from fastapi.security import OAuth2PasswordBearer
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text

from config import get_settings
from src.api.auth.router import router as router_auth
from src.api.user.router import router as router_user
from src.api.yoga_pose.router import router as router_yoga_pose
from src.api.network.router import router as router_network
from src.api.result_prediction.router import router as router_result_prediction
from src.api.report.router import router as router_report
from src.api.request_to_admin_status.router import router as router_request_to_admin_status
from src.api.rept.router import router as router_rept
from src.database.config import async_engine

from alembic import command
from alembic.config import Config

settings = get_settings()

LOCK_FILE = Path("/tmp/alembic_migration.lock")
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Используем файловую блокировку, чтобы только один процесс запускал миграции
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    with open(LOCK_FILE, "w") as lock_file:
        try:
            # Попытка получить эксклюзивную блокировку (неблокирующая)
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Если блокировка получена, запускаем миграции
            process = await asyncio.create_subprocess_exec("alembic", "upgrade", "head")
            await process.communicate()
            if process.returncode != 0:
                raise RuntimeError(f"Alembic migration failed with return code {process.returncode}")
        except BlockingIOError:
            # Блокировка уже занята другим процессом, ждем завершения миграций
            # Ждем, пока другой процесс освободит блокировку (блокирующий режим)
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

    async with async_engine.begin() as connection:
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS dict_schema"))
        await connection.execute(text("ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)"))
        await connection.execute(text("ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE"))
        await connection.execute(text("ALTER TABLE IF EXISTS dict_schema.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)"))
        await connection.execute(text("ALTER TABLE IF EXISTS dict_schema.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE"))
        await connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'users'
                    ) THEN
                        CREATE TABLE IF NOT EXISTS public.password_reset_codes (
                            id BIGSERIAL PRIMARY KEY,
                            user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                            code_hash VARCHAR(256) NOT NULL,
                            expires_at TIMESTAMP NOT NULL,
                            used BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    END IF;
                END $$;
                """
            )
        )
        await connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'password_reset_codes'
                    ) THEN
                        CREATE INDEX IF NOT EXISTS ix_password_reset_codes_user_id
                        ON public.password_reset_codes(user_id);
                    END IF;
                END $$;
                """
            )
        )
        await connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'dict_schema'
                          AND table_name = 'users'
                    ) THEN
                        CREATE TABLE IF NOT EXISTS dict_schema.password_reset_codes (
                            id BIGSERIAL PRIMARY KEY,
                            user_id BIGINT NOT NULL REFERENCES dict_schema.users(id) ON DELETE CASCADE,
                            code_hash VARCHAR(256) NOT NULL,
                            expires_at TIMESTAMP NOT NULL,
                            used BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    END IF;
                END $$;
                """
            )
        )
        await connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'dict_schema'
                          AND table_name = 'password_reset_codes'
                    ) THEN
                        CREATE INDEX IF NOT EXISTS ix_dict_password_reset_codes_user_id
                        ON dict_schema.password_reset_codes(user_id);
                    END IF;
                END $$;
                """
            )
        )
    
    yield


app = FastAPI(lifespan=lifespan)

# CORS настройки из переменных окружения
cors_origins_str = os.getenv("CORS_ORIGINS", "*")
# Если указан *, разрешаем все источники (без credentials), иначе разбиваем по запятой
if cors_origins_str == "*":
    cors_origins = ["*"]
    allow_credentials = False
else:
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserActivityMiddleware(BaseHTTPMiddleware):
    _skip_prefixes = ("/metrics", "/api/auth/token", "/api/auth/registration")

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        if response.status_code >= 400:
            return response
        path = request.url.path
        if any(path.startswith(prefix) for prefix in self._skip_prefixes):
            return response
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return response
        try:
            from jose import jwt
            from config import get_settings
            from src.user_activity import record_user_activity

            payload = jwt.decode(token, get_settings().SECRET_KEY, algorithms=["HS256"])
            login = (payload.get("login") or "").strip()
            if login:
                record_user_activity(login)
        except Exception:
            pass
        return response


app.add_middleware(UserActivityMiddleware)


@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    path = request.url.path
    method = request.method
    HTTP_REQUESTS_TOTAL.labels("server-module", method, path, str(response.status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels("server-module", method, path).observe(elapsed)
    return response

app.include_router(router_auth, prefix="/api/auth", tags=["Авторизация/Регистрация"])
app.include_router(router_user, prefix="/api/users", tags=["Пользователи"])
app.include_router(router_yoga_pose, prefix="/api/yoga_poses", tags=["Позиции йоги"])
app.include_router(router_network, prefix="/api/network", tags=["Нейронная сеть"])
app.include_router(router_result_prediction, prefix="/api/result_prediction", tags=["Результат предсказаний"])
app.include_router(router_report, prefix="/api/reports", tags=["Сообщения об ошибках"])
app.include_router(router_request_to_admin_status, prefix="/api/request_to_admin_status", tags=["Запросы на статус администратора"])
app.include_router(router_rept, prefix="/api/rept", tags=["Отчеты"])


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(settings.PORT_SERVER))

"""
    По поводу ограничения к запросам:
    1) Авторизация/Регистрация не требуется доп ограничений
    2) Пользователи не требуют доп ограничений
    3) Позиции йоги не требует доп ограничений
    4) НС не требует доп ограничений
    5) Резы 
        5.1) Получение всез резов - ограничений не требуется
        5.2) Получение опреденного реза - требуюется проверка админ ли он или обладатель
        5.3) Такая же проверка как и выше
"""

"""
    7) Возврат ошибок юзерфрендли
    8) Добавить функцию на запрос админки
"""