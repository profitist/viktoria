from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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


class ColumnReorderItem(BaseModel):
    """Новая позиция конкретной колонки."""

    id: UUID
    """ID колонки."""

    position: int
    """Новая позиция колонки."""


class ColumnReorder(BaseModel):
    """Массовое обновление порядка колонок."""

    columns: list[ColumnReorderItem]
    """Список колонок с новыми position."""


class ColumnOut(BaseModel):
    """Колонка доски со списком задач. Возвращается в составе BoardOut."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    position: int
    color: str | None
    tasks: list[TaskOut] = Field(default_factory=list)
    """Задачи колонки, отсортированные по position. Пустой список если задач нет."""


class BoardOut(BaseModel):
    """Полное состояние доски: все колонки с задачами внутри. Основной payload для рендера UI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    columns: list[ColumnOut]
    """Колонки отсортированы по полю position по возрастанию."""


class BoardCreate(BaseModel):
    """Тело запроса создания новой доски workspace. Только для admin/owner."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    project_id: UUID | None = None


class BoardPatch(BaseModel):
    """Частичное обновление доски. Только переданные поля будут изменены."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    project_id: UUID | None = None


class BoardCreatedOut(BaseModel):
    """Краткое представление доски после создания."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    project_id: UUID | None


class BoardListItem(BaseModel):
    """Краткое описание доски для переключателя досок и секции избранного."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    project_id: UUID | None
    is_favorite: bool


class BoardDetail(BaseModel):
    """Полное состояние одной доски по контракту multi-board API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    project_id: UUID | None
    is_favorite: bool
    columns: list[ColumnOut]
    """Колонки отсортированы по полю position по возрастанию."""


class FavoriteResponse(BaseModel):
    is_favorite: bool


class BoardResponse(BaseModel):
    board: BoardOut


class BoardCreatedResponse(BaseModel):
    board: BoardCreatedOut


class BoardDetailResponse(BaseModel):
    board: BoardDetail


class ColumnResponse(BaseModel):
    column: ColumnOut
