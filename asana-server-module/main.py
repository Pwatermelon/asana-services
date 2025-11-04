import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer

from config import get_settings
from src.api.auth.router import router as router_auth
from src.api.user.router import router as router_user
from src.api.yoga_pose.router import router as router_yoga_pose
from src.api.network.router import router as router_network
from src.api.result_prediction.router import router as router_result_prediction
from src.api.report.router import router as router_report
from src.api.request_to_admin_status.router import router as router_request_to_admin_status
from src.api.rept.router import router as router_rept

from alembic import command
from alembic.config import Config

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    process = await asyncio.create_subprocess_exec("alembic", "upgrade", "head")
    await process.communicate()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://yoga-project-network.ru", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_auth, prefix="/api/auth", tags=["Авторизация/Регистрация"])
app.include_router(router_user, prefix="/api/users", tags=["Пользователи"])
app.include_router(router_yoga_pose, prefix="/api/yoga_poses", tags=["Позиции йоги"])
app.include_router(router_network, prefix="/api/network", tags=["Нейронная сеть"])
app.include_router(router_result_prediction, prefix="/api/result_prediction", tags=["Результат предсказаний"])
app.include_router(router_report, prefix="/api/reports", tags=["Сообщения об ошибках"])
app.include_router(router_request_to_admin_status, prefix="/api/request_to_admin_status", tags=["Запросы на статус администратора"])
app.include_router(router_rept, prefix="/api/rept", tags=["Отчеты"])


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