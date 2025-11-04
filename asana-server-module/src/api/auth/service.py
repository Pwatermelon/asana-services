from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth.exceptions import LoginExistsException, CredentialsException, MailExistsException
from src.api.auth.schemas import Token, ResetPasswordDto
from src.api.auth.utils.auth_utils import authenticate_user, create_access_token, get_password_hash
from src.api.auth.utils.mail_utils import generate_verification_token_mail, send_verification_email, verify_token_mail, \
    send_reset_password_request
from src.api.user.schemas import UserOutDto, UserRegistrationDto
from src.api.user.service import UserService


class AuthService:
    def __init__(self):
        self.user_service = UserService()

    async def auth_user(self, login: str, password: str, session: AsyncSession) -> Token:
        user: UserOutDto = await authenticate_user(login, password, session)
        access_token = create_access_token(
            data={"login": user.login}
        )
        return Token(access_token=access_token, token_type="bearer")

    async def registration_user(self, user_data: UserRegistrationDto, session: AsyncSession) -> UserOutDto:
        user: UserOutDto = await self.user_service.get_user_by_login(user_data.login, session)
        if user is not None:
            raise LoginExistsException()
        user: UserOutDto = await self.user_service.get_user_by_mail(user_data.mail, session)
        if user is not None:
            raise MailExistsException()

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
            raise CredentialsException()

        token = generate_verification_token_mail(user.mail)
        send_reset_password_request(user.mail, token)

    async def reset_password(self, reset_password_data: ResetPasswordDto, session: AsyncSession) -> UserOutDto:
        mail = verify_token_mail(reset_password_data.token)
        password = get_password_hash(reset_password_data.password)
        return await self.user_service.patch_password(mail, password, session)
