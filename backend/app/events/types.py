from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

EventType = Literal["task.created", "task.updated", "task.moved", "task.deleted"]


class EventEnvelope(BaseModel):
    event_id: UUID
    event_type: EventType
    workspace_id: UUID
    task_id: UUID
    timestamp: datetime
    actor_id: UUID
    payload: dict[str, Any]
