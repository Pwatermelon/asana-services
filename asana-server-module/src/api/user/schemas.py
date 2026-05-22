from pydantic import BaseModel

from src.database.models import User


class UserAuthDto(BaseModel):
    login: str
    password: str


class UserRegistrationDto(BaseModel):
    login: str
    mail: str
    password: str


class UserOutDto(BaseModel):
    id: int
    login: str
    mail: str
    password: str
    is_admin: bool
    permission_study: bool
    is_verify: bool
    is_blocked: bool = False
    avatar_url: str | None = None

    @staticmethod
    def from_user(user: User) -> "UserOutDto":
        return UserOutDto(
            id=user.id,
            login=user.login,
            mail=user.mail,
            password=user.password,
            is_admin=user.is_admin,
            permission_study=user.permission_study,
            is_verify=user.is_verify,
            is_blocked=getattr(user, "is_blocked", False),
            avatar_url=user.avatar_url,
        )


class ChangePasswordDto(BaseModel):
    current_password: str
    new_password: str
