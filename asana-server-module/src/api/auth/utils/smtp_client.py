"""Отправка почты: Яндекс/Gmail (465 SSL) и 587 STARTTLS."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from config import get_settings
from src.api.auth.utils.smtp_env import smtp_host, smtp_port, smtp_user, smtp_password, smtp_from

settings = get_settings()


def _yandex_auth_hint(user: str, raw: bytes | str) -> str:
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
    base = (
        f"SMTP отклонил вход для {user!r} на smtp.yandex.ru. "
        "SMTP_USER и SMTP_FROM = полный @yandex.ru, SMTP_PASSWORD = пароль приложения (не основной пароль)."
    )
    if "access rights" in text.lower() or "does not have access" in text.lower():
        return (
            f"{base} "
            "Яндекс: id.yandex.ru → Безопасность → пароль приложения (тип «Почта»); "
            "в mail.yandex.ru → Настройки → «Почтовые программы» включить IMAP/SMTP."
        )
    return (
        f"{base} "
        "Создайте новый пароль приложения на id.yandex.ru и обновите SMTP_PASSWORD в /app/.env."
    )


def send_email(to: str, subject: str, body: str) -> None:
    host = smtp_host()
    if not host:
        raise ValueError("SMTP_HOST не задан. Укажите SMTP_HOST=smtp.yandex.ru в /app/.env")

    user = smtp_user() or (settings.SMTP_USER or "").strip()
    password = smtp_password() or (settings.SMTP_PASSWORD or "").strip()
    if not user or not password:
        raise ValueError("SMTP_USER или SMTP_PASSWORD не заданы в .env")

    port = smtp_port(465)
    from_addr = smtp_from(user) or getattr(settings, "SMTP_FROM", None) or user

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
    except smtplib.SMTPAuthenticationError as exc:
        hint = _yandex_auth_hint(user, exc.smtp_error if hasattr(exc, "smtp_error") else exc.args[-1] if exc.args else b"")
        raise smtplib.SMTPAuthenticationError(exc.smtp_code, hint.encode("utf-8")) from exc
    except smtplib.SMTPException as exc:
        raise RuntimeError(f"SMTP ошибка ({host}:{port}): {exc}") from exc
    except OSError as exc:
        raise OSError(
            f"Не удалось подключиться к SMTP {host!r}:{port}. Проверьте SMTP_HOST в /app/.env. "
            f"Исходная ошибка: {exc}"
        ) from exc
