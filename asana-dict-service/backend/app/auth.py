from __future__ import annotations
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from app import config
from app.models import TokenData, User, UserRole
import logging
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("asana_service.auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

engine = create_engine(config.SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(username: str, password: str):
    logger.debug(f"Attempting to authenticate user: {username}")
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    db.close()
    
    if not user:
        logger.warning(f"User not found: {username}")
        return False
        
    if not verify_password(password, user.password_hash):
        logger.warning(f"Invalid password for user: {username}")
        return False
        
    logger.info(f"Successfully authenticated user: {username}")
    return {"username": user.username, "role": user.role}

def create_access_token(data: dict, remember_me: bool = False):
    to_encode = data.copy()
    
    # Если пользователь выбрал "запомнить меня", увеличиваем срок действия токена
    if remember_me:
        expire_minutes = 44640  # 31 день (в минутах)
    else:
        expire_minutes = config.ACCESS_TOKEN_EXPIRE_MINUTES
        
    expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
    to_encode.update({
        "exp": expire,
        "role": data.get("role", "guest")  # Добавляем роль в токен
    })
    logger.debug(f"Creating token for {data.get('sub')} with role {data.get('role')} expiring at {expire}")
    encoded_jwt = jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        logger.debug("Decoding JWT token")
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logger.warning("Token missing username claim")
            raise credentials_exception
            
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        db.close()
        
        if user is None:
            logger.warning(f"User from token not found: {username}")
            raise credentials_exception
            
        token_data = TokenData(username=username, role=user.role)
        logger.debug(f"Successfully validated token for user: {username} with role: {user.role}")
        return token_data.username
    except JWTError as e:
        logger.error(f"Token validation failed: {str(e)}")
        raise credentials_exception

async def get_current_active_user(user: str = Depends(get_current_user)):
    db = SessionLocal()
    db_user = db.query(User).filter(User.username == user).first()
    db.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")
        
    if not db_user.is_confirmed:
        raise HTTPException(status_code=403, detail="Email not confirmed")
        
    return user

def is_admin(user: str = Depends(get_current_user)):
    db = SessionLocal()
    db_user = db.query(User).filter(User.username == user).first()
    db.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not db_user.is_confirmed:
        raise HTTPException(status_code=403, detail="Email not confirmed")
        
    if db_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль администратора.")
        
    return user

def is_expert_or_admin(user: str = Depends(get_current_user)):
    db = SessionLocal()
    db_user = db.query(User).filter(User.username == user).first()
    db.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not db_user.is_confirmed:
        raise HTTPException(status_code=403, detail="Email not confirmed")
        
    if db_user.role not in [UserRole.ADMIN, UserRole.EXPERT]:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа. Требуется роль эксперта или администратора.")
        
    return user

def generate_confirmation_code(length=6):
    """Генерирует случайный код подтверждения"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def send_confirmation_email(email: str, code: str):
    """Отправляет электронное письмо с кодом подтверждения"""
    try:
        # Настройки SMTP из конфига
        smtp_server = config.SMTP_SERVER
        smtp_port = config.SMTP_PORT
        smtp_user = config.SMTP_USER
        smtp_password = config.SMTP_PASSWORD
        
        # Создаем сообщение
        msg = MIMEMultipart()
        msg['From'] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM}>"
        msg['To'] = email
        msg['Subject'] = "Подтверждение регистрации в каталоге асан"
        
        # Создаем текст сообщения
        body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .code {{ font-size: 24px; font-weight: bold; text-align: center; 
                        padding: 15px; background: #f3f4f6; border-radius: 8px; 
                        margin: 20px 0; letter-spacing: 3px; }}
                .footer {{ text-align: center; margin-top: 30px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Подтверждение регистрации</h2>
                </div>
                <p>Здравствуйте!</p>
                <p>Спасибо за регистрацию в каталоге асан. Для активации вашего аккаунта, пожалуйста, введите следующий код на странице подтверждения:</p>
                <div class="code">{code}</div>
                <p>Если вы не регистрировались в нашем сервисе, просто проигнорируйте это письмо.</p>
                <div class="footer">
                    С уважением,<br>
                    Команда Каталога Асан
                </div>
            </div>
        </body>
        </html>
        """
        
        # Добавляем HTML-контент
        msg.attach(MIMEText(body, 'html'))
        
        # Подключаемся к серверу SMTP
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        
        # Отправляем сообщение
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Confirmation email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {str(e)}")
        return False

def send_password_reset_email(email: str, code: str):
    """Отправляет электронное письмо для сброса пароля"""
    try:
        # Настройки SMTP из конфига
        smtp_server = config.SMTP_SERVER
        smtp_port = config.SMTP_PORT
        smtp_user = config.SMTP_USER
        smtp_password = config.SMTP_PASSWORD
        
        # Создаем сообщение
        msg = MIMEMultipart()
        msg['From'] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM}>"
        msg['To'] = email
        msg['Subject'] = "Сброс пароля в каталоге асан"
        
        # Создаем текст сообщения
        body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .code {{ font-size: 24px; font-weight: bold; text-align: center; 
                        padding: 15px; background: #f3f4f6; border-radius: 8px; 
                        margin: 20px 0; letter-spacing: 3px; }}
                .footer {{ text-align: center; margin-top: 30px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Сброс пароля</h2>
                </div>
                <p>Здравствуйте!</p>
                <p>Вы запросили сброс пароля в каталоге асан. Для установки нового пароля введите следующий код на странице сброса пароля:</p>
                <div class="code">{code}</div>
                <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
                <div class="footer">
                    С уважением,<br>
                    Команда Каталога Асан
                </div>
            </div>
        </body>
        </html>
        """
        
        # Добавляем HTML-контент
        msg.attach(MIMEText(body, 'html'))
        
        # Подключаемся к серверу SMTP
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        
        # Отправляем сообщение
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email: {str(e)}")
        return False

def register_user(username: str, email: str, first_name: str, last_name: str, password: str):
    """Регистрирует нового пользователя с ролью GUEST"""
    db = SessionLocal()
    
    # Проверяем, что пользователь с таким именем не существует
    if db.query(User).filter(User.username == username).first():
        db.close()
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    
    # Проверяем, что email не занят
    if db.query(User).filter(User.email == email).first():
        db.close()
        raise HTTPException(status_code=400, detail="Email уже занят")
    
    # Генерируем код подтверждения
    confirmation_code = generate_confirmation_code()
    
    # Создаем пользователя
    user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password_hash=get_password_hash(password),
        role=UserRole.GUEST,  # Новые пользователи всегда получают роль GUEST
        is_confirmed=False,
        confirmation_code=confirmation_code
    )
    
    db.add(user)
    db.commit()
    db.close()
    
    # Отправляем письмо с подтверждением
    send_confirmation_email(email, confirmation_code)
    
    return {"username": username, "email": email}

def confirm_registration(confirmation_code: str):
    """Подтверждает регистрацию пользователя по коду"""
    db = SessionLocal()
    user = db.query(User).filter(User.confirmation_code == confirmation_code).first()
    
    if not user:
        db.close()
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")
    
    user.is_confirmed = True
    user.confirmation_code = None
    db.commit()
    db.close()
    
    return {"username": user.username, "confirmed": True}

def reset_password_request(email: str):
    """Запрос на сброс пароля"""
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        db.close()
        # Не сообщаем о том, что email не найден (для безопасности)
        return {"message": "Если указанный email зарегистрирован, на него отправлено письмо для сброса пароля"}
    
    # Генерируем код сброса пароля
    reset_code = generate_confirmation_code()
    user.confirmation_code = reset_code
    db.commit()
    db.close()
    
    # Отправляем письмо для сброса пароля
    send_password_reset_email(email, reset_code)
    
    return {"message": "Если указанный email зарегистрирован, на него отправлено письмо для сброса пароля"}

def reset_password_confirm(code: str, new_password: str):
    """Подтверждение сброса пароля"""
    db = SessionLocal()
    user = db.query(User).filter(User.confirmation_code == code).first()
    
    if not user:
        db.close()
        raise HTTPException(status_code=400, detail="Неверный код сброса пароля")
    
    user.password_hash = get_password_hash(new_password)
    user.confirmation_code = None
    db.commit()
    db.close()
    
    return {"username": user.username, "reset": True}
