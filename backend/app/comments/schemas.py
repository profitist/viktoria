from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    body: str


class CommentAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    author: CommentAuthor
    body: str
    mentions: list[UUID]
    created_at: datetime
