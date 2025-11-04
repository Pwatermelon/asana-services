import smtplib

import loguru
from itsdangerous import URLSafeTimedSerializer
from config import get_settings

settings = get_settings()
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def generate_verification_token_mail(mail: str) -> str:
    return serializer.dumps(mail, salt="mail-confirmation")

def verify_token_mail(token: str) -> str | None:
    try:
        return serializer.loads(token, salt="mail-confirmation", max_age=3600)
    except:
        return None

def send_verification_email(mail: str, token: str):
    text = f"Для подтверждения регистрации перейдите по ссылке: http://yoga-project-network.ru/auth/login/{token}"
    message = """\
    From: %s
    To: %s
    Subject: %s

    %s
    """ % (settings.SMTP_USER, mail, "Подтверждение регистрации", text)
    loguru.logger.info("Начинаем соединение")
    server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT)
    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    server.set_debuglevel(1)
    server.sendmail(settings.SMTP_USER, mail, message.encode("utf8"))
    server.quit()

def send_reset_password_request(mail: str, token: str):
    text = f"Для восстановления пароля перейдите по ссылке: http://yoga-project-network.ru/auth/reset-password/{token}"
    message = """\
    From: %s
    To: %s
    Subject: %s

    %s
    """ % (settings.SMTP_USER, mail, "Восстановление пароля", text)
    loguru.logger.info("Начинаем соединение")
    server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT)
    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    server.set_debuglevel(1)
    server.sendmail(settings.SMTP_USER, mail, message.encode("utf8"))
    server.quit()



