from datetime import datetime
from urllib.request import Request

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.schemas import ResetPasswordDto
from src.api.request_to_admin_status.schemas import RequestToAdminStatusEnum
from src.api.user.schemas import UserRegistrationDto
from src.database.models import User, RequestToAdminStatus


class UserRepository:
    async def get_user_by_login(self, login: str, session: AsyncSession) -> User | None:
        user = await session.execute(
            select(User).where(and_(User.login == login, User.is_verify == True))
        )
        return user.scalar_one_or_none()

    async def get_user_by_mail(self, mail: str, session: AsyncSession) -> User | None:
        user = await session.execute(
            select(User).where(and_(User.mail == mail, User.is_verify == True))
        )
        return user.scalar_one_or_none()

    async def create_user(self, user_data: UserRegistrationDto, session: AsyncSession) -> User:
        user: User = User(
            login=user_data.login,
            mail=user_data.mail,
            password=user_data.password,
            is_admin=False,
            permission_study=True,
            is_verify=False
        )
        session.add(user)
        await session.commit()
        await session.flush()
        return user

    async def patch_permission_study_by_id(self, user_id: int, permission: bool, session: AsyncSession) -> User:
        user = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        user.permission_study = permission
        await session.commit()
        await session.flush()
        return user

    async def verify_user(self, mail: str, session: AsyncSession) -> User:
        user = await session.execute(
            select(User).where(User.mail == mail)
        )
        user = user.scalar_one_or_none()
        user.is_verify = True
        await session.commit()
        await session.flush()
        return user

    async def patch_password(self, mail: str, password: str, session: AsyncSession) -> User:
        user = await session.execute(
            select(User).where(User.mail == mail)
        )
        user = user.scalar_one_or_none()
        user.password = password
        await session.commit()
        await session.flush()
        return user