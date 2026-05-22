import loguru
from itsdangerous import URLSafeTimedSerializer

from config import get_settings
from src.api.auth.utils.smtp_client import send_email

settings = get_settings()
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def generate_verification_token_mail(mail: str) -> str:
    return serializer.dumps(mail, salt="mail-confirmation")


def verify_token_mail(token: str) -> str | None:
    try:
        return serializer.loads(token, salt="mail-confirmation", max_age=3600)
    except Exception:
        return None


def send_verification_email(mail: str, token: str) -> None:
    text = (
        f"Для подтверждения регистрации перейдите по ссылке: "
        f"https://catalog-asan.ru/auth/login/{token}"
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
