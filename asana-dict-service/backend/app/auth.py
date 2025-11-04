from __future__ import annotations
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from app import config
from app.models import User, UserRole
import logging
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

logger = logging.getLogger("asana_service.auth")

# OAuth2 схема для получения токена из заголовка Authorization
# tokenUrl указывается для совместимости, но авторизация идет через внешний сервис
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

engine = create_engine(config.SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Авторизация и создание токенов теперь обрабатываются внешним сервисом
# Токены приходят извне и проверяются через get_current_user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Проверяет токен, который приходит из внешнего сервиса авторизации.
    Токен должен быть в заголовке Authorization: Bearer <token>
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    try:
        logger.debug("Decoding JWT token from external auth service")
        # Декодируем токен (предполагается, что токен создан внешним сервисом с тем же SECRET_KEY)
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            logger.warning("Token missing username claim")
            raise credentials_exception
        
        # Проверяем, что пользователь существует в БД (может быть не обязательно, если все данные в токене)
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        db.close()
        
        if user is None:
            logger.warning(f"User from token not found in DB: {username}")
            # Можно не требовать наличия пользователя в БД, если роль берется из токена
            # Но для безопасности лучше проверить
            raise credentials_exception
        
        logger.debug(f"Successfully validated token for user: {username} with role: {user.role}")
        return username
    except JWTError as e:
        logger.error(f"Token validation failed: {str(e)}")
        raise credentials_exception

def is_admin(user: str = Depends(get_current_user)):
    """Проверяет, что пользователь является администратором"""
    db = SessionLocal()
    db_user = db.query(User).filter(User.username == user).first()
    db.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверка подтверждения email может быть не нужна, если это обрабатывается внешним сервисом
    # if not db_user.is_confirmed:
    #     raise HTTPException(status_code=403, detail="Email not confirmed")
        
    if db_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль администратора.")
        
    return user

def is_expert_or_admin(user: str = Depends(get_current_user)):
    """Проверяет, что пользователь является экспертом или администратором"""
    db = SessionLocal()
    db_user = db.query(User).filter(User.username == user).first()
    db.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверка подтверждения email может быть не нужна, если это обрабатывается внешним сервисом
    # if not db_user.is_confirmed:
    #     raise HTTPException(status_code=403, detail="Email not confirmed")
        
    if db_user.role not in [UserRole.ADMIN, UserRole.EXPERT]:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль эксперта или администратора.")
        
    return user

# Функции регистрации, подтверждения email и сброса пароля теперь обрабатываются внешним сервисом
