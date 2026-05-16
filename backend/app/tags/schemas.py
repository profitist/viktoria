from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.tags.models import DEFAULT_TAG_COLOR


class TagCreate(BaseModel):
    name: str
    color: str = DEFAULT_TAG_COLOR


class TagRef(BaseModel):
    id: UUID
    board_id: UUID | None = None
    name: str | None = None
    color: str | None = None


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    board_id: UUID
    name: str
    color: str


class TaskTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: UUID
    tag_id: UUID
