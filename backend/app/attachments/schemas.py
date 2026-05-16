from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentUploader(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    filename: str | None
    content_type: str | None
    size: int | None
    url: str
    uploaded_by: AttachmentUploader | None
    created_at: datetime
