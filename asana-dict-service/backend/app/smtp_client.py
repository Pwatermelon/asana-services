"""Отправка почты: Яндекс/Gmail (465 SSL) и 587 STARTTLS."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app import config
from app.smtp_env import smtp_host, smtp_port, smtp_user, smtp_password, smtp_from


def send_email(to: str, subject: str, body: str) -> None:
    host = smtp_host()
    if not host:
        raise ValueError("SMTP_HOST не задан")

    user = smtp_user()
    password = smtp_password()
    if not user or not password:
        raise ValueError("SMTP_USER или SMTP_PASSWORD не заданы в .env")

    port = smtp_port(int(config.SMTP_PORT))
    from_addr = smtp_from(user)

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                server.login(user, password)
                server.send_message(msg)
            return

        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.send_message(msg)
    except OSError as exc:
        raise OSError(
            f"Не удалось подключиться к SMTP {host!r}:{port} — проверьте SMTP_HOST в /app/.env "
            f"(без лишних символов вроде '}}'). Исходная ошибка: {exc}"
        ) from exc
    except smtplib.SMTPAuthenticationError as exc:
        raise smtplib.SMTPAuthenticationError(
            exc.smtp_code,
            (
                f"SMTP отклонил логин/пароль ({user}@{host}:{port}). "
                "Для Яндекса: пароль приложения на id.yandex.ru, "
                "SMTP_USER=полный email, SMTP_FROM=тот же email, без кавычек в .env."
            ),
        ) from exc
