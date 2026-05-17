from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WorkspaceCreate(BaseModel):
    """Тело запроса создания нового пространства команды."""

    name: str = Field(min_length=1, max_length=100)
    """Человекочитаемое название workspace, например «Команда А»."""
    slug: str = Field(min_length=1, max_length=60, pattern=r'^[a-z0-9][a-z0-9-]*[a-z0-9]$')
    """URL-идентификатор workspace, уникален глобально. Только строчные буквы, цифры, дефис."""


class WorkspaceOut(BaseModel):
    """Публичное представление workspace. Возвращается при создании и в списке /workspaces/me."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    role: Literal["owner", "admin", "member"]
    """Роль текущего пользователя в этом workspace."""


class MemberInvite(BaseModel):
    """Тело запроса приглашения участника в workspace. Только для admin и owner."""

    email: EmailStr
    """Email приглашаемого пользователя — должен быть зарегистрирован в системе."""
    role: Literal["admin", "member"]
    """owner нельзя назначить через invite — он только один и назначается при создании."""


class MemberOut(BaseModel):
    """Участник workspace с его ролью и датой вступления."""

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str
    name: str
    role: Literal["owner", "admin", "member"]
    joined_at: datetime


class MyTaskSchema(BaseModel):
    id: UUID
    title: str
    priority: str
    deadline: datetime | None
    deadline_urgency: str
    assignee_id: UUID | None
    assignee_name: str | None
    board_id: UUID
    board_name: str
    column_id: UUID
    column_name: str
    is_done: bool


class WorkspaceSettingsPatch(BaseModel):
    """Частичное обновление настроек workspace. Все поля опциональны."""

    automation_enabled: bool | None = None
    """Если False — AutomationEngine пропускает все правила этого workspace."""


class WorkspaceSettingsOut(BaseModel):
    """Текущие настройки workspace. Возвращается в ответе PATCH /settings."""

    model_config = ConfigDict(from_attributes=True)

    workspace_id: UUID
    automation_enabled: bool
