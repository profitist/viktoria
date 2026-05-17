from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.audit.models import AuditLog
from app.database import AsyncSessionLocal
from app.tasks.models import Task


class AuditRecorder:
    async def record(self, enriched_event: dict[str, Any]) -> AuditLog | None:
        workspace_id = _as_uuid(enriched_event.get("workspace_id"))
        task_id = _as_uuid(enriched_event.get("task_id"))
        actor_id = _as_uuid(enriched_event.get("actor_id"))
        if workspace_id is None or task_id is None or actor_id is None:
            return None

        payload = enriched_event.get("payload")
        payload_dict = payload if isinstance(payload, dict) else {}
        board_id = _extract_board_id(enriched_event, payload_dict)

        async with AsyncSessionLocal() as session:
            existing_board_id = await session.scalar(
                select(Task.board_id).where(Task.id == task_id)
            )
            audit_task_id = task_id if existing_board_id is not None else None
            if board_id is None:
                board_id = existing_board_id

            audit_log = AuditLog(
                workspace_id=workspace_id,
                task_id=audit_task_id,
                board_id=board_id,
                event_type=str(enriched_event.get("event_type", "")),
                actor_id=actor_id,
                changes=_build_changes(str(enriched_event.get("event_type", "")), payload_dict),
            )
            session.add(audit_log)
            await session.commit()
            await session.refresh(audit_log)
            return audit_log


def _extract_board_id(
    enriched_event: dict[str, Any],
    payload: dict[str, Any],
) -> UUID | None:
    value = payload.get("board_id") or enriched_event.get("board_id")
    return _as_uuid(value)


def _build_changes(
    event_type: str,
    payload: dict[str, Any],
) -> list[dict[str, Any]]:
    if event_type in {"task.created", "task.deleted"}:
        return []

    changes: list[dict[str, Any]] = []
    for field, value in payload.items():
        changes.append({"field": str(field), "old": None, "new": _jsonable(value)})
    return changes


def _as_uuid(value: Any) -> UUID | None:
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError:
            return None
    return None


def _jsonable(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    return value
