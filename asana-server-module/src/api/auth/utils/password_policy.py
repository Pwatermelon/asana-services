from fastapi import HTTPException
from starlette import status


def password_rule_map(password: str) -> dict[str, bool]:
    value = password or ""
    return {
        "length": len(value) >= 12,
        "upper": any(ch.isupper() for ch in value),
        "lower": any(ch.islower() for ch in value),
        "digit": any(ch.isdigit() for ch in value),
        "special": any(not ch.isalnum() for ch in value),
        "no_space": all(not ch.isspace() for ch in value),
    }


def validate_strong_password(password: str) -> None:
    rules = password_rule_map(password)
    if all(rules.values()):
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Пароль не соответствует требованиям: минимум 12 символов, "
            "строчные и заглавные буквы, цифра, спецсимвол, без пробелов."
        ),
    )
