"""Отправка почты: Gmail (465 SSL) и Microsoft 365 / Outlook (587 STARTTLS)."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from config import get_settings
from src.api.auth.utils.smtp_env import smtp_host, smtp_port

settings = get_settings()


def send_email(to: str, subject: str, body: str) -> None:
    host = (settings.SMTP_SERVER or smtp_host()).strip()
    if not host:
        raise ValueError("SMTP_HOST не задан (пустой). Укажите SMTP_HOST=smtp.yandex.ru в .env")

    port = int(settings.SMTP_PORT or smtp_port())
    from_addr = getattr(settings, "SMTP_FROM", None) or settings.SMTP_USER

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
