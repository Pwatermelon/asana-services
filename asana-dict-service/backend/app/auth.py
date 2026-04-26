from __future__ import annotations
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from starlette.requests import Request
from fastapi.security import OAuth2PasswordBearer
from app import config
from app.models import UserRole
import logging
import httpx
from typing import Optional

logger = logging.getLogger("asana_service.auth")

# OAuth2 схема для получения токена из заголовка Authorization
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Авторизация обрабатывается через server-module API
# Используем HTTP запросы к сервису авторизации
# Для синхронных эндпоинтов используем синхронный httpx клиент

def get_current_user_sync(token: str, request: Request = None) -> Optional[str]:
    """
    Синхронная проверка токена через API server-module.
    Используется для синхронных эндпоинтов.
    """
    if not token and request:
        token = request.cookies.get("access_token")
    
    if not token:
        return None
    
    try:
        # Используем синхронный клиент для синхронных эндпоинтов
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                f"{config.AUTH_SERVICE_URL}/api/users/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-DB-Schema": "dict_schema"  # Указываем схему для dict-service
                }
            )
            
            if response.status_code == 200:
                user_data = response.json()
                login = user_data.get("login")
                if login:
                    logger.debug(f"Successfully validated token for user: {login}")
                    return login
    except Exception as e:
        logger.error(f"Error validating token via auth service: {str(e)}")
        # Fallback: проверяем токен локально
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
            login = payload.get("login")
            if login:
                logger.debug(f"Fallback: validated token locally for user: {login}")
                return login
        except JWTError:
            pass
    
    return None

async def get_current_user(token: str = Depends(oauth2_scheme), request: Request = None):
    """
    Проверяет токен через API server-module и получает информацию о пользователе.
    Токен должен быть в заголовке Authorization: Bearer <token>
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token and request:
        token = request.cookies.get("access_token")
    
    if not token:
        raise credentials_exception
    
    try:
        # Делаем запрос к server-module для проверки токена и получения информации о пользователе
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{config.AUTH_SERVICE_URL}/api/users/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-DB-Schema": "dict_schema"  # Указываем схему для dict-service
                }
            )
            
            if response.status_code == 401:
                raise credentials_exception
            
            if response.status_code != 200:
                logger.warning(f"Failed to get user from auth service: {response.status_code}")
                raise credentials_exception
            
            user_data = response.json()
            login = user_data.get("login")
            
            if not login:
                logger.warning("User data missing login")
                raise credentials_exception
            
            logger.debug(f"Successfully validated token for user: {login}")
            return login
            
    except httpx.RequestError as e:
        logger.error(f"Error connecting to auth service: {str(e)}")
        # Fallback: проверяем токен локально если сервис недоступен
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
            login = payload.get("login")
            if login:
                logger.debug(f"Fallback: validated token locally for user: {login}")
                return login
        except JWTError:
            pass
        
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}")
        raise credentials_exception

def get_user_info_from_token_sync(token: str) -> Optional[dict]:
    """Синхронно получает информацию о пользователе из server-module по токену"""
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                f"{config.AUTH_SERVICE_URL}/api/users/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-DB-Schema": "dict_schema"  # Указываем схему для dict-service
                }
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Error getting user info from auth service: {str(e)}")
    return None

async def get_user_info_from_token(token: str) -> Optional[dict]:
    """Асинхронно получает информацию о пользователе из server-module по токену"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{config.AUTH_SERVICE_URL}/api/users/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Error getting user info from auth service: {str(e)}")
    return None

def get_current_user_from_request(request: Request):
    """Получает токен из request и возвращает пользователя"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token not found")
    
    # Используем синхронную функцию для получения информации о пользователе
    user_data = get_user_info_from_token_sync(token)
    if user_data:
        login = user_data.get("login")
        if login:
            return login
    
    raise HTTPException(status_code=401, detail="Could not validate credentials")


def import_status_user_from_jwt(request: Request) -> str:
    """
    Логин для GET /api/import/status — только проверка подписи JWT (тот же SECRET_KEY, что у server-module).
    Без HTTP к server-module: на проде poll не упирается в лимиты/задержки /api/users/me.
    Права «эксперт» здесь не перепроверяем: задачу мог создать только уже авторизованный POST; доступ к чужому task_id режется по owner в обработчике.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token not found")
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    login = (payload.get("login") or "").strip()
    if not login:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    return login


def is_admin(request: Request):
    """Проверяет, что пользователь является администратором через server-module (один запрос к /api/users/me)."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token not found")

    user_data = get_user_info_from_token_sync(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    login = user_data.get("login")
    if not login:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    if user_data.get("is_admin"):
        return login

    raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль администратора.")


def is_expert_or_admin(request: Request):
    """
    Эксперт или админ через server-module.
    Раньше шёл вложенный Depends(get_current_user_from_request) + повторный get_user_info_from_token_sync
    — два HTTP на каждый poll статуса импорта; при лимите соединений к auth зависало после пары запросов.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token not found")

    user_data = get_user_info_from_token_sync(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    login = user_data.get("login")
    if not login:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    is_admin_flag = user_data.get("is_admin", False)
    permission_study = user_data.get("permission_study", False)
    if is_admin_flag or permission_study:
        return login

    raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль эксперта или администратора.")

# Функции регистрации, подтверждения email и сброса пароля теперь обрабатываются внешним сервисом
