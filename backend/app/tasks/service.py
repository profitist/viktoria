from __future__ import annotations

import difflib
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from aio_pika.abc import AbstractChannel
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.board.models import Column
from app.events.publisher import publish
from app.events.types import EventEnvelope
from app.tasks.models import DeadlineUrgency as DeadlineUrgencyModel
from app.tasks.models import Task, TaskPriority as TaskPriorityModel
from app.tasks.schemas import TaskCreate, TaskMoveRequest, TaskOut, TaskPatch
from app.workspace.models import WorkspaceMember


class SimilarTasksFound(Exception):
    def __init__(self, candidates: list[tuple[Task, float]]) -> None:
        self.candidates = candidates
        super().__init__("similar tasks found")


async def create_task(
    session: AsyncSession,
    payload: TaskCreate,
    current_user: User,
    channel: AbstractChannel,
) -> TaskOut:
    column = await _get_column_or_404(session, payload.column_id)
    workspace_id = column.board.workspace_id
    await _require_workspace_member(session, workspace_id, current_user.id)

    if not payload.force:
        candidates = await find_similar_tasks(
            session=session,
            workspace_id=workspace_id,
            title=payload.title,
        )
        if candidates:
            raise SimilarTasksFound(candidates)

    task = Task(
        title=payload.title,
        description=payload.description or "",
        column_id=payload.column_id,
        workspace_id=workspace_id,
        priority=TaskPriorityModel(payload.priority),
        tags=list(payload.tags),
        assignee_id=payload.assignee_id,
        deadline=payload.deadline,
        deadline_urgency=DeadlineUrgencyModel(compute_deadline_urgency(payload.deadline)),
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    await publish(
        _build_event(
            event_type="task.created",
            workspace_id=task.workspace_id,
            task_id=task.id,
            actor_id=current_user.id,
            payload=_task_payload(task),
        ),
        channel,
    )

    return _to_task_out(task)


async def update_task(
    session: AsyncSession,
    task_id: UUID,
    payload: TaskPatch,
    current_user: User,
    channel: AbstractChannel,
) -> TaskOut:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    changed_fields: dict[str, Any] = {}

    if "title" in payload.model_fields_set and payload.title is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="title cannot be null",
        )

    if "title" in payload.model_fields_set and payload.title != task.title:
        task.title = payload.title
        changed_fields["title"] = payload.title

    if "description" in payload.model_fields_set:
        description = payload.description or ""
        if description != task.description:
            task.description = description
            changed_fields["description"] = description

    if "priority" in payload.model_fields_set and payload.priority is not None:
        priority = TaskPriorityModel(payload.priority)
        if priority != task.priority:
            task.priority = priority
            changed_fields["priority"] = priority.value

    if "tags" in payload.model_fields_set and payload.tags is not None:
        tags = list(payload.tags)
        if tags != task.tags:
            task.tags = tags
            changed_fields["tags"] = tags

    if "assignee_id" in payload.model_fields_set and payload.assignee_id != task.assignee_id:
        task.assignee_id = payload.assignee_id
        changed_fields["assignee_id"] = payload.assignee_id

    if "deadline" in payload.model_fields_set:
        if payload.deadline != task.deadline:
            task.deadline = payload.deadline
            task.deadline_urgency = DeadlineUrgencyModel(
                compute_deadline_urgency(payload.deadline)
            )
            changed_fields["deadline"] = payload.deadline
            changed_fields["deadline_urgency"] = task.deadline_urgency.value

    if not changed_fields:
        return _to_task_out(task)

    await session.commit()
    await session.refresh(task)

    await publish(
        _build_event(
            event_type="task.updated",
            workspace_id=task.workspace_id,
            task_id=task.id,
            actor_id=current_user.id,
            payload=_serialize_value(changed_fields),
        ),
        channel,
    )

    return _to_task_out(task)


async def move_task(
    session: AsyncSession,
    task_id: UUID,
    payload: TaskMoveRequest,
    current_user: User,
    channel: AbstractChannel,
) -> TaskOut:
    if payload.position < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="position must be greater than or equal to 0",
        )

    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    target_column = await _get_column_or_404(session, payload.column_id)
    if target_column.board.workspace_id != task.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="column not found",
        )

    from_column_id = task.column_id
    task.column_id = payload.column_id

    await session.commit()
    await session.refresh(task)

    await publish(
        _build_event(
            event_type="task.moved",
            workspace_id=task.workspace_id,
            task_id=task.id,
            actor_id=current_user.id,
            payload=_serialize_value(
                {
                    "from_column_id": from_column_id,
                    "column_id": task.column_id,
                    "position": payload.position,
                }
            ),
        ),
        channel,
    )

    return _to_task_out(task)


async def delete_task(
    session: AsyncSession,
    task_id: UUID,
    current_user: User,
    channel: AbstractChannel,
) -> None:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    workspace_id = task.workspace_id
    column_id = task.column_id
    title = task.title

    await session.delete(task)
    await session.commit()

    await publish(
        _build_event(
            event_type="task.deleted",
            workspace_id=workspace_id,
            task_id=task_id,
            actor_id=current_user.id,
            payload=_serialize_value(
                {
                    "task_id": task_id,
                    "column_id": column_id,
                    "title": title,
                }
            ),
        ),
        channel,
    )


async def get_task(
    session: AsyncSession,
    task_id: UUID,
    current_user: User,
) -> TaskOut:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)
    return _to_task_out(task)


async def list_tasks(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
    column_id: UUID | None = None,
    assignee_id: UUID | None = None,
    tag: str | None = None,
) -> list[TaskOut]:
    await _require_workspace_member(session, workspace_id, current_user.id)

    stmt = select(Task).where(Task.workspace_id == workspace_id)

    if column_id is not None:
        stmt = stmt.where(Task.column_id == column_id)
    if assignee_id is not None:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if tag is not None:
        stmt = stmt.where(Task.tags.contains([tag]))

    result = await session.execute(stmt.order_by(Task.created_at.asc(), Task.id.asc()))
    tasks = result.scalars().all()
    return [_to_task_out(task) for task in tasks]


def compute_deadline_urgency(deadline: datetime | None) -> str:
    if deadline is None:
        return DeadlineUrgencyModel.NONE.value

    normalized_deadline = _normalize_datetime(deadline)
    delta = normalized_deadline - datetime.now(UTC)

    if delta <= timedelta(hours=24):
        return DeadlineUrgencyModel.CRITICAL.value
    if delta <= timedelta(hours=72):
        return DeadlineUrgencyModel.SOON.value
    return DeadlineUrgencyModel.NONE.value


async def _get_task_or_404(session: AsyncSession, task_id: UUID) -> Task:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="task not found",
        )
    return task


async def _get_column_or_404(session: AsyncSession, column_id: UUID) -> Column:
    column = await session.scalar(
        select(Column)
        .options(selectinload(Column.board))
        .where(Column.id == column_id)
    )
    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="column not found",
        )
    return column


async def _require_workspace_member(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found",
        )
    return membership


async def find_similar_tasks(
    session: AsyncSession,
    workspace_id: UUID,
    title: str,
    threshold: float = 0.6,
    max_tasks: int = 500,
) -> list[tuple[Task, float]]:
    # Лимит предотвращает деградацию на больших workspace (OWASP API4:2023).
    # 500 задач достаточно для практического fuzzy-поиска — статистически
    # охватывает активный бэклог любого реального проекта.
    result = await session.execute(
        select(Task)
        .options(selectinload(Task.column))
        .where(Task.workspace_id == workspace_id)
        .limit(max_tasks)
    )
    tasks = result.scalars().all()
    if not tasks:
        return []

    title_lower = title.lower()
    candidates: list[tuple[Task, float]] = []
    for task in tasks:
        ratio = difflib.SequenceMatcher(None, title_lower, task.title.lower()).ratio()
        if ratio >= threshold:
            candidates.append((task, ratio))

    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[:5]


def _build_event(
    event_type: str,
    workspace_id: UUID,
    task_id: UUID,
    actor_id: UUID,
    payload: dict[str, Any],
) -> EventEnvelope:
    return EventEnvelope(
        event_id=uuid4(),
        event_type=event_type,
        workspace_id=workspace_id,
        task_id=task_id,
        timestamp=datetime.now(UTC),
        actor_id=actor_id,
        payload=payload,
    )


def _task_payload(task: Task) -> dict[str, Any]:
    return _serialize_value(
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "column_id": task.column_id,
            "workspace_id": task.workspace_id,
            "priority": task.priority,
            "tags": list(task.tags),
            "assignee_id": task.assignee_id,
            "created_at": task.created_at,
            "deadline": task.deadline,
            "deadline_urgency": compute_deadline_urgency(task.deadline),
        }
    )


def _to_task_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        column_id=task.column_id,
        workspace_id=task.workspace_id,
        priority=task.priority.value,
        tags=list(task.tags),
        assignee_id=task.assignee_id,
        created_at=task.created_at,
        deadline=task.deadline,
        deadline_urgency=compute_deadline_urgency(task.deadline),
    )


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return _normalize_datetime(value).isoformat()
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    return value


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
