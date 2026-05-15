from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.tasks.schemas import TaskOut


class ColumnCreate(BaseModel):
    """Тело запроса создания новой колонки на доске. Только для admin/owner."""

    name: str
    """Название колонки, например «To Do», «In Review», «Done»."""
    position: int
    """Порядковый номер колонки слева направо, начиная с 0."""
    color: str | None = None
    """HEX-цвет заголовка колонки, например #FF5733. Опционально."""


class ColumnPatch(BaseModel):
    """Частичное обновление колонки. Все поля опциональны — передаются только изменяемые."""

    name: str | None = None
    position: int | None = None
    color: str | None = None


class ColumnOut(BaseModel):
    """Колонка доски со списком задач. Возвращается в составе BoardOut."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    position: int
    color: str | None
    tasks: list[TaskOut] = []
    """Задачи колонки, отсортированные по position. Пустой список если задач нет."""


class BoardOut(BaseModel):
    """Полное состояние доски: все колонки с задачами внутри. Основной payload для рендера UI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    columns: list[ColumnOut]
    """Колонки отсортированы по полю position по возрастанию."""