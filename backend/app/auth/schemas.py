from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class RegisterRequest(BaseModel):
    """Тело запроса регистрации нового пользователя."""

    email: EmailStr
    """Уникальный email — используется как логин."""
    password: str
    """Пароль в открытом виде — хэшируется в сервисе, сюда не возвращается."""
    name: str
    """Отображаемое имя пользователя."""


class LoginRequest(BaseModel):
    """Тело запроса входа в систему."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Тело запроса обновления access-токена."""

    refresh_token: str
    """Refresh-токен, полученный при логине. Живёт 30 дней."""


class UserOut(BaseModel):
    """Публичное представление пользователя. Возвращается в ответах, не содержит пароль."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    """UUID пользователя."""
    email: str
    name: str


class TokenResponse(BaseModel):
    """Ответ на успешный логин или регистрацию."""

    access_token: str
    """JWT access-токен. Живёт 15 минут. Передаётся в заголовке Authorization: Bearer."""
    refresh_token: str
    """JWT refresh-токен. Живёт 30 дней. Используется только для обновления access-токена."""
    user: UserOut