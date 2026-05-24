import os

import loguru
from itsdangerous import URLSafeTimedSerializer

from config import get_settings
from src.api.auth.utils.smtp_client import send_email

settings = get_settings()
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def _public_site_url() -> str:
    explicit = (os.getenv("PUBLIC_SITE_URL") or os.getenv("SITE_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    minio_prefix = (os.getenv("MINIO_URL_PREFIX") or "").strip().rstrip("/")
    if minio_prefix.endswith("/images"):
        return minio_prefix[: -len("/images")]
    if minio_prefix:
        return minio_prefix
    return "https://catalog-asan.ru"


def generate_verification_token_mail(mail: str) -> str:
    return serializer.dumps(mail, salt="mail-confirmation")


def verify_token_mail(token: str) -> str | None:
    try:
        return serializer.loads(token, salt="mail-confirmation", max_age=3600)
    except Exception:
        return None


def send_verification_email(mail: str, token: str) -> None:
    site = _public_site_url()
    text = (
        f"Для подтверждения регистрации перейдите по ссылке:\n"
        f"{site}/auth/login/{token}"
    )
    loguru.logger.info("Отправка письма подтверждения на %s", mail)
    send_email(mail, "Подтверждение регистрации", text)


def send_reset_password_request(mail: str, otp_code: str) -> None:
    text = (
        f"Код для восстановления пароля: {otp_code}\n\n"
        "Код действует 15 минут. Если вы не запрашивали восстановление пароля, "
        "просто проигнорируйте письмо."
    )
    loguru.logger.info("Отправка OTP восстановления пароля на %s", mail)
    send_email(mail, "Восстановление пароля", text)
