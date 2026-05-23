from datetime import datetime, timedelta
import random
import loguru
from fastapi import HTTPException

from prometheus_client import Counter
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.exceptions import LoginExistsException, CredentialsException, MailExistsException
from src.api.auth.schemas import Token, ResetPasswordDto, ResetPasswordVerifyDto
from src.api.auth.utils.auth_utils import authenticate_user, create_access_token, get_password_hash, verify_password
from src.api.auth.utils.mail_utils import generate_verification_token_mail, send_verification_email, verify_token_mail, send_reset_password_request
from src.api.auth.utils.password_policy import validate_strong_password
from src.api.user.schemas import UserOutDto, UserRegistrationDto
from src.api.user.service import UserService
from src.database.models import PasswordResetCode
from config import get_settings

settings = get_settings()
PASSWORD_RESET_REQUESTS_TOTAL = Counter(
    "password_reset_requests_total",
    "Password reset requests",
    ["result"],
)
PASSWORD_RESET_VERIFICATIONS_TOTAL = Counter(
    "password_reset_verifications_total",
    "Password reset verification attempts",
    ["result"],
)


class AuthService:
    def __init__(self):
        self.user_service = UserService()

    async def auth_user(self, login: str, password: str, session: AsyncSession) -> Token:
        user: UserOutDto = await authenticate_user(login, password, session)
        if user.is_blocked:
            raise HTTPException(status_code=403, detail="Учетная запись заблокирована администратором")
        access_token = create_access_token(
            data={"login": user.login}
        )
        try:
            from src.user_activity import record_user_activity

            record_user_activity(user.login)
        except Exception:
            pass
        return Token(access_token=access_token, token_type="bearer")

    async def registration_user(self, user_data: UserRegistrationDto, session: AsyncSession) -> UserOutDto:
        user: UserOutDto = await self.user_service.get_user_by_login(user_data.login, session)
        if user is not None:
            raise LoginExistsException()
        user: UserOutDto = await self.user_service.get_user_by_mail(user_data.mail, session)
        if user is not None:
            raise MailExistsException()

        validate_strong_password(user_data.password)
        user_data.password = get_password_hash(user_data.password)

        user_created = await self.user_service.create_user(user_data, session)
        token = generate_verification_token_mail(user_created.mail)
        send_verification_email(user_created.mail, token)

        return user_created

    async def verify_token(self, token: str, session: AsyncSession) -> UserOutDto:
        mail = verify_token_mail(token)
        return await self.user_service.verify_user(mail, session)

    async def reset_password_request(self, login: str, session: AsyncSession) -> None:
        user: UserOutDto = await self.user_service.get_user_by_login(login, session)
        if user is None:
            user: UserOutDto = await self.user_service.get_user_by_mail(login, session)

        if user is None:
            PASSWORD_RESET_REQUESTS_TOTAL.labels("not_found").inc()
            raise CredentialsException()

        await session.execute(delete(PasswordResetCode).where(PasswordResetCode.user_id == user.id))
        ttl_minutes = int(getattr(settings, "PASSWORD_RESET_OTP_TTL_MINUTES", "15") or "15")
        code = f"{random.randint(0, 999999):06d}"
        code_hash = get_password_hash(code)
        reset_code = PasswordResetCode(
            user_id=user.id,
            code_hash=code_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
            used=False,
        )
        session.add(reset_code)
        await session.flush()
        try:
            send_reset_password_request(user.mail, code)
        except Exception as exc:
            await session.rollback()
            PASSWORD_RESET_REQUESTS_TOTAL.labels("smtp_error").inc()
            loguru.logger.exception("SMTP error on password reset for %s: %s", user.login, exc)
            raise HTTPException(
                status_code=503,
                detail="Не удалось отправить письмо. Проверьте SMTP на сервере (SMTP_HOST=smtp.yandex.ru, пароль приложения Яндекса).",
            ) from exc
        await session.commit()
        PASSWORD_RESET_REQUESTS_TOTAL.labels("ok").inc()

    async def verify_reset_code(self, payload: ResetPasswordVerifyDto, session: AsyncSession) -> None:
        user: UserOutDto = await self.user_service.get_user_by_login(payload.login, session)
        if user is None:
            user = await self.user_service.get_user_by_mail(payload.login, session)
        if user is None:
            PASSWORD_RESET_VERIFICATIONS_TOTAL.labels("not_found").inc()
            raise CredentialsException()

        query = await session.execute(
            select(PasswordResetCode)
            .where(PasswordResetCode.user_id == user.id, PasswordResetCode.used == False)
            .order_by(PasswordResetCode.id.desc())
            .limit(1)
        )
        code_row = query.scalar_one_or_none()
        if code_row is None or code_row.expires_at < datetime.utcnow():
            PASSWORD_RESET_VERIFICATIONS_TOTAL.labels("expired").inc()
            raise CredentialsException()
        if not verify_password(payload.code, code_row.code_hash):
            PASSWORD_RESET_VERIFICATIONS_TOTAL.labels("invalid").inc()
            raise CredentialsException()
        PASSWORD_RESET_VERIFICATIONS_TOTAL.labels("ok").inc()

    async def reset_password(self, reset_password_data: ResetPasswordDto, session: AsyncSession) -> UserOutDto:
        await self.verify_reset_code(
            ResetPasswordVerifyDto(login=reset_password_data.login, code=reset_password_data.code),
            session,
        )
        user: UserOutDto = await self.user_service.get_user_by_login(reset_password_data.login, session)
        if user is None:
            user = await self.user_service.get_user_by_mail(reset_password_data.login, session)
        if user is None:
            raise CredentialsException()

        validate_strong_password(reset_password_data.password)
        password = get_password_hash(reset_password_data.password)
        updated = await self.user_service.patch_password(user.mail, password, session)
        await session.execute(delete(PasswordResetCode).where(PasswordResetCode.user_id == user.id))
        await session.commit()
        return updated
