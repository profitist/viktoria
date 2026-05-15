from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    """
    In-app уведомление пользователя. Хранится в БД, доставляется через WebSocket (JSON-RPC метод
    notification.created) и доступно через REST GET /api/v1/notifications.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    """Тип события, породившего уведомление: task.moved, rule_fired, deadline.approaching и т.д."""
    message: str
    """Человекочитаемый текст уведомления для отображения в UI."""
    data: dict[str, Any]
    """Произвольный payload события — task_id, column_id и т.д. Используется UI для deeplink."""
    read: bool
    """False пока пользователь не открыл уведомление или не вызвал PATCH /notifications/{id}/read."""
    created_at: datetime