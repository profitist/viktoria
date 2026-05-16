from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

TaskPriority = Literal["low", "medium", "high", "critical"]
"""Приоритет задачи. Влияет на сортировку и визуальную индикацию в UI."""

DeadlineUrgency = Literal["none", "soon", "critical"]
"""
Срочность по дедлайну, вычисляется в tasks/service.py при каждом чтении:
  none     — дедлайна нет или до него больше 72 часов
  soon     — от 24 до 72 часов
  critical — менее 24 часов или дедлайн уже прошёл
Не хранится в БД.
"""


class TaskCreate(BaseModel):
    """Тело запроса создания задачи. Перед сохранением сервис проверяет дубликат по title+column."""

    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    column_id: UUID
    """Колонка, в которую задача попадает при создании."""
    board_id: UUID | None = None
    """Доска задачи. В T-030 станет обязательной для дедупликации и фильтрации."""
    priority: TaskPriority = "medium"
    tags: list[str] = []
    """Свободные теги. Используются в условиях правил автоматизации."""
    assignee_id: UUID | None = None
    """UUID участника workspace. Если None — задача не назначена."""
    deadline: datetime | None = None


class TaskPatch(BaseModel):
    """Частичное обновление задачи. Только переданные поля будут изменены."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    priority: TaskPriority | None = None
    tags: list[str] | None = None
    assignee_id: UUID | None = None
    deadline: datetime | None = None


class TaskMoveRequest(BaseModel):
    """Тело запроса перемещения задачи в другую колонку (drag-drop)."""

    column_id: UUID
    """Целевая колонка."""
    position: int
    """Позиция среди задач целевой колонки, начиная с 0."""


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)


class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    title: str
    is_done: bool
    order: int


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    is_done: bool | None = None
    order: int | None = None


class SubtaskProgress(BaseModel):
    done_count: int
    total_count: int


class TaskOut(BaseModel):
    """Полное представление задачи. Возвращается во всех read-операциях и WebSocket-событиях."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    column_id: UUID
    board_id: UUID
    workspace_id: UUID
    priority: TaskPriority
    tags: list[str]
    assignee_id: UUID | None
    created_at: datetime
    deadline: datetime | None
    deadline_urgency: DeadlineUrgency
    subtask_progress: SubtaskProgress | None = None
    """Агрегат подзадач. Вычисляется на backend, не хранится в БД."""


class DuplicateCheckOut(BaseModel):
    """Ответ на проверку существования задачи с таким же названием в колонке."""

    exists: bool
    task_id: UUID | None = None
    """UUID найденной задачи-дубликата. None если exists=False."""
