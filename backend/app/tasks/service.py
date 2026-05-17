from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from aio_pika.abc import AbstractChannel
from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.board.models import Column
from app.events.publisher import publish
from app.events.types import EventEnvelope
from app.tags.schemas import TagOut
from app.tags.service import get_task_tags_by_task_id, replace_task_tags
from app.tasks.models import DeadlineUrgency as DeadlineUrgencyModel
from app.tasks.models import Subtask, Task, TaskPriority as TaskPriorityModel
from app.tasks.schemas import (
    SubtaskCreate,
    SubtaskOut,
    SubtaskUpdate,
    TaskCreate,
    TaskListPage,
    TaskMoveRequest,
    TaskOut,
    TaskPatch,
)
from app.workspace.models import WorkspaceMember


class DuplicateTaskError(Exception):
    def __init__(self, existing_task_id: UUID) -> None:
        self.existing_task_id = existing_task_id
        super().__init__("task already exists")


async def create_task(
    session: AsyncSession,
    payload: TaskCreate,
    current_user: User,
    channel: AbstractChannel,
) -> TaskOut:
    column = await _get_column_or_404(session, payload.column_id)
    workspace_id = column.board.workspace_id
    await _require_workspace_member(session, workspace_id, current_user.id)

    duplicate = await _find_duplicate_task(
        session=session,
        board_id=column.board_id,
        column_id=payload.column_id,
        title=payload.title,
    )
    if duplicate is not None:
        raise DuplicateTaskError(duplicate.id)

    task = Task(
        title=payload.title,
        description=payload.description or "",
        column_id=payload.column_id,
        board_id=column.board_id,
        workspace_id=workspace_id,
        priority=TaskPriorityModel(payload.priority),
        tags=[],
        assignee_id=payload.assignee_id,
        deadline=payload.deadline,
        deadline_urgency=DeadlineUrgencyModel(compute_deadline_urgency(payload.deadline)),
    )
    session.add(task)
    await session.flush()
    await replace_task_tags(session, task, payload.tags)
    await session.commit()
    await session.refresh(task)
    task_out = await _to_task_out(session, task)

    await publish(
        _build_event(
            event_type="task.created",
            workspace_id=task.workspace_id,
            task_id=task.id,
            actor_id=current_user.id,
            payload=_task_payload(task, task_out.tags),
        ),
        channel,
    )

    return task_out


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
        duplicate = await _find_duplicate_task(
            session=session,
            board_id=task.board_id,
            column_id=task.column_id,
            title=payload.title,
            exclude_task_id=task.id,
        )
        if duplicate is not None:
            raise DuplicateTaskError(duplicate.id)
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
        tags, tags_changed = await replace_task_tags(session, task, payload.tags)
        if tags_changed:
            changed_fields["tags"] = _serialize_tags(tags)

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
            changed_fields["deadline_days_remaining"] = (
                compute_deadline_days_remaining(payload.deadline)
            )
            changed_fields["deadline_urgency"] = task.deadline_urgency.value

    if not changed_fields:
        return await _to_task_out(session, task)

    await session.commit()
    await session.refresh(task)
    task_out = await _to_task_out(session, task)

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

    return task_out


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

    duplicate = await _find_duplicate_task(
        session=session,
        board_id=target_column.board_id,
        column_id=payload.column_id,
        title=task.title,
        exclude_task_id=task.id,
    )
    if duplicate is not None:
        raise DuplicateTaskError(duplicate.id)

    from_column_id = task.column_id
    from_board_id = task.board_id
    task.column_id = payload.column_id
    task.board_id = target_column.board_id
    if from_board_id != task.board_id:
        await replace_task_tags(session, task, list(task.tags or []))

    await session.commit()
    await session.refresh(task)

    await _publish_task_moved(
        channel=channel,
        task=task,
        actor_id=current_user.id,
        from_board_id=from_board_id,
        from_column_id=from_column_id,
        position=payload.position,
    )

    return await _to_task_out(session, task)


async def mark_task_done(
    session: AsyncSession,
    task_id: UUID,
    current_user: User,
    channel: AbstractChannel,
) -> TaskOut:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    result = await session.execute(
        select(Column)
        .where(Column.board_id == task.board_id)
        .order_by(Column.position.asc(), Column.id.asc())
    )
    columns = result.scalars().all()
    if not columns:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="column not found",
        )

    first_column = columns[0]
    last_column = columns[-1]
    target_column = first_column if task.column_id == last_column.id else last_column

    duplicate = await _find_duplicate_task(
        session=session,
        board_id=task.board_id,
        column_id=target_column.id,
        title=task.title,
        exclude_task_id=task.id,
    )
    if duplicate is not None:
        raise DuplicateTaskError(duplicate.id)

    from_column_id = task.column_id
    from_board_id = task.board_id
    task.column_id = target_column.id

    await session.commit()
    await session.refresh(task)

    await _publish_task_moved(
        channel=channel,
        task=task,
        actor_id=current_user.id,
        from_board_id=from_board_id,
        from_column_id=from_column_id,
        position=target_column.position,
    )

    return await _to_task_out(session, task)


async def delete_task(
    session: AsyncSession,
    task_id: UUID,
    current_user: User,
    channel: AbstractChannel,
) -> None:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    workspace_id = task.workspace_id
    board_id = task.board_id
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
                    "board_id": board_id,
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
    return await _to_task_out(session, task)


async def list_tasks(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
    board_id: UUID | None = None,
    column_id: UUID | None = None,
    assignee_id: UUID | None = None,
    tag: str | None = None,
    sort: str | None = None,
    page: int | None = None,
    page_size: int = 50,
    deadline_from: datetime | None = None,
    deadline_to: datetime | None = None,
) -> list[TaskOut] | TaskListPage:
    await _require_workspace_member(session, workspace_id, current_user.id)

    filters = [Task.workspace_id == workspace_id]

    if board_id is not None:
        filters.append(Task.board_id == board_id)
    if column_id is not None:
        filters.append(Task.column_id == column_id)
    if assignee_id is not None:
        filters.append(Task.assignee_id == assignee_id)
    if tag is not None:
        filters.append(Task.tags.contains([tag]))
    if deadline_from is not None:
        filters.append(Task.deadline >= deadline_from)
    if deadline_to is not None:
        filters.append(Task.deadline <= deadline_to)

    order_by = _task_list_order_by(sort)
    stmt = select(Task).where(*filters).order_by(*order_by)

    if page is None:
        result = await session.execute(stmt)
        tasks = result.scalars().all()
        return await _build_task_list(session, tasks)

    total = await session.scalar(select(func.count(Task.id)).where(*filters))
    offset = (page - 1) * page_size
    result = await session.execute(stmt.offset(offset).limit(page_size))
    tasks = result.scalars().all()
    return TaskListPage(
        items=await _build_task_list(session, tasks),
        total=total or 0,
        page=page,
        page_size=page_size,
    )


async def _build_task_list(session: AsyncSession, tasks: list[Task]) -> list[TaskOut]:
    tags_by_task_id = await get_task_tags_by_task_id(session, [task.id for task in tasks])
    return [_build_task_out(task, tags_by_task_id.get(task.id, [])) for task in tasks]


def _task_list_order_by(sort: str | None) -> list[Any]:
    if sort is None:
        return [Task.created_at.asc(), Task.id.asc()]

    descending = sort.startswith("-")
    field = sort[1:] if descending else sort

    if field == "created_at":
        expression = Task.created_at
    elif field == "deadline":
        expression = Task.deadline
    elif field == "priority":
        expression = _priority_order_expression()
    elif field == "title":
        expression = Task.title
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid sort",
        )

    ordered_expression = expression.desc() if descending else expression.asc()
    tie_breaker = Task.id.desc() if descending else Task.id.asc()
    return [ordered_expression, tie_breaker]


def _priority_order_expression() -> Any:
    return case(
        *(
            (Task.priority == priority, index)
            for index, priority in enumerate(TaskPriorityModel)
        )
    )


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


def compute_deadline_days_remaining(deadline: datetime | None) -> int | None:
    if deadline is None:
        return None

    deadline_date = _normalize_datetime(deadline).date()
    today = datetime.now(UTC).date()
    return (deadline_date - today).days


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


async def _find_duplicate_task(
    session: AsyncSession,
    board_id: UUID,
    column_id: UUID,
    title: str,
    exclude_task_id: UUID | None = None,
) -> Task | None:
    stmt = select(Task).where(
        Task.board_id == board_id,
        Task.column_id == column_id,
        Task.title == title,
    )
    if exclude_task_id is not None:
        stmt = stmt.where(Task.id != exclude_task_id)
    return await session.scalar(stmt)


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


async def _publish_task_moved(
    channel: AbstractChannel,
    task: Task,
    actor_id: UUID,
    from_board_id: UUID,
    from_column_id: UUID,
    position: int,
) -> None:
    await publish(
        _build_event(
            event_type="task.moved",
            workspace_id=task.workspace_id,
            task_id=task.id,
            actor_id=actor_id,
            payload=_serialize_value(
                {
                    "from_board_id": from_board_id,
                    "board_id": task.board_id,
                    "from_column_id": from_column_id,
                    "column_id": task.column_id,
                    "position": position,
                }
            ),
        ),
        channel,
    )


def _task_payload(task: Task, tags: list[TagOut]) -> dict[str, Any]:
    return _serialize_value(
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "column_id": task.column_id,
            "board_id": task.board_id,
            "workspace_id": task.workspace_id,
            "priority": task.priority,
            "tags": _serialize_tags(tags),
            "assignee_id": task.assignee_id,
            "created_at": task.created_at,
            "deadline": task.deadline,
            "deadline_days_remaining": compute_deadline_days_remaining(
                task.deadline
            ),
            "deadline_urgency": compute_deadline_urgency(task.deadline),
        }
    )


async def _to_task_out(session: AsyncSession, task: Task) -> TaskOut:
    tags_by_task_id = await get_task_tags_by_task_id(session, [task.id])
    return _build_task_out(task, tags_by_task_id.get(task.id, []))


def _build_task_out(task: Task, tags: list[TagOut]) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        column_id=task.column_id,
        board_id=task.board_id,
        workspace_id=task.workspace_id,
        priority=task.priority.value,
        tags=tags,
        assignee_id=task.assignee_id,
        created_at=task.created_at,
        deadline=task.deadline,
        deadline_days_remaining=compute_deadline_days_remaining(task.deadline),
        deadline_urgency=compute_deadline_urgency(task.deadline),
    )


def _serialize_tags(tags: list[TagOut]) -> list[dict[str, Any]]:
    return [tag.model_dump(mode="json") for tag in tags]


async def get_subtasks(
    session: AsyncSession,
    task_id: UUID,
    current_user: User,
) -> list[SubtaskOut]:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)
    result = await session.execute(
        select(Subtask)
        .where(Subtask.task_id == task_id)
        .order_by(Subtask.order, Subtask.id)
    )
    return [SubtaskOut.model_validate(st) for st in result.scalars()]


async def create_subtask(
    session: AsyncSession,
    task_id: UUID,
    payload: SubtaskCreate,
    current_user: User,
) -> SubtaskOut:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    max_order = await session.scalar(
        select(func.max(Subtask.order)).where(Subtask.task_id == task_id)
    )
    order = (max_order if max_order is not None else -1) + 1

    subtask = Subtask(task_id=task_id, title=payload.title, order=order)
    session.add(subtask)
    await session.commit()
    await session.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


async def update_subtask(
    session: AsyncSession,
    task_id: UUID,
    subtask_id: UUID,
    payload: SubtaskUpdate,
    current_user: User,
) -> SubtaskOut:
    subtask = await _get_subtask_or_404(session, subtask_id, task_id)
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    if "title" in payload.model_fields_set and payload.title is not None:
        subtask.title = payload.title
    if "is_done" in payload.model_fields_set and payload.is_done is not None:
        subtask.is_done = payload.is_done
    if "order" in payload.model_fields_set and payload.order is not None:
        subtask.order = payload.order

    await session.commit()
    await session.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


async def delete_subtask(
    session: AsyncSession,
    task_id: UUID,
    subtask_id: UUID,
    current_user: User,
) -> None:
    subtask = await _get_subtask_or_404(session, subtask_id, task_id)
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)
    await session.delete(subtask)
    await session.commit()


async def _get_subtask_or_404(
    session: AsyncSession,
    subtask_id: UUID,
    task_id: UUID,
) -> Subtask:
    subtask = await session.scalar(
        select(Subtask).where(Subtask.id == subtask_id, Subtask.task_id == task_id)
    )
    if subtask is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="subtask not found",
        )
    return subtask


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
