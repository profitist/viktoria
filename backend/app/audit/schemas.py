from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.auth.schemas import UserOut


class AuditChangeItem(BaseModel):
    """Одно изменённое поле задачи: что было и что стало."""

    field: str
    """Название поля задачи: title, priority, column_id, tags и т.д."""
    old: Any
    """Значение до изменения. None если поле только появилось."""
    new: Any
    """Значение после изменения. None если поле было удалено."""


class AuditLogOut(BaseModel):
    """
    Запись в истории изменений задачи. Формируется автоматически из EventEnvelope
    в audit/recorder.py — вручную не создаётся.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    """Тип события: task.created, task.updated, task.moved, task.deleted."""
    actor: UserOut
    """Пользователь, инициировавший изменение."""
    task_id: UUID | None
    """UUID задачи. None только если задача уже удалена из БД."""
    task_title: str | None
    """Название задачи на момент события. None если задача удалена."""
    changes: list[AuditChangeItem]
    """Список изменённых полей. Пустой для task.created и task.deleted."""
    created_at: datetime