from __future__ import annotations

from collections.abc import Iterable, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.board.models import Board
from app.tags.models import DEFAULT_TAG_COLOR, Tag, TaskTag
from app.tags.schemas import TagCreate, TagOut, TagRef
from app.tasks.models import Task
from app.workspace.models import WorkspaceMember

TagInput = str | TagRef | TagOut


async def get_board_tags(
    session: AsyncSession,
    board_id: UUID,
    current_user: User,
) -> list[TagOut]:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)

    result = await session.execute(
        select(Tag).where(Tag.board_id == board.id).order_by(Tag.name.asc(), Tag.id.asc())
    )
    return [_to_tag_out(tag) for tag in result.scalars().all()]


async def create_tag(
    session: AsyncSession,
    board_id: UUID,
    payload: TagCreate,
    current_user: User,
) -> TagOut:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)

    name = _normalize_tag_name(payload.name)
    if name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tag name cannot be blank",
        )

    duplicate = await session.scalar(
        select(Tag.id).where(Tag.board_id == board.id, Tag.name == name)
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tag already exists",
        )

    tag = Tag(board_id=board.id, name=name, color=payload.color or DEFAULT_TAG_COLOR)
    session.add(tag)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tag already exists",
        ) from exc

    await session.refresh(tag)
    return _to_tag_out(tag)


async def delete_tag(
    session: AsyncSession,
    board_id: UUID,
    tag_id: UUID,
    current_user: User,
) -> None:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)

    tag = await session.scalar(select(Tag).where(Tag.id == tag_id, Tag.board_id == board.id))
    if tag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="tag not found",
        )

    linked_tasks = await _get_tasks_for_tag(session, tag.id)
    for task in linked_tasks:
        task.tags = _remove_legacy_tag(task.tags, tag.name)

    await session.delete(tag)
    await session.commit()


async def add_tag_to_task(
    session: AsyncSession,
    task_id: UUID,
    tag_id: UUID,
    current_user: User,
) -> None:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    tag = await _get_tag_or_404(session, tag_id)
    if tag.board_id != task.board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="tag not found",
        )

    existing = await session.scalar(
        select(TaskTag).where(TaskTag.task_id == task.id, TaskTag.tag_id == tag.id)
    )
    if existing is None:
        session.add(TaskTag(task_id=task.id, tag_id=tag.id))

    task.tags = _append_legacy_tag(task.tags, tag.name)
    await session.commit()


async def remove_tag_from_task(
    session: AsyncSession,
    task_id: UUID,
    tag_id: UUID,
    current_user: User,
) -> None:
    task = await _get_task_or_404(session, task_id)
    await _require_workspace_member(session, task.workspace_id, current_user.id)

    tag = await _get_tag_or_404(session, tag_id)
    if tag.board_id != task.board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="tag not found",
        )

    await session.execute(
        delete(TaskTag).where(TaskTag.task_id == task.id, TaskTag.tag_id == tag.id)
    )
    task.tags = _remove_legacy_tag(task.tags, tag.name)
    await session.commit()


async def get_task_tags_by_task_id(
    session: AsyncSession,
    task_ids: Sequence[UUID],
) -> dict[UUID, list[TagOut]]:
    if not task_ids:
        return {}

    result = await session.execute(
        select(TaskTag.task_id, Tag)
        .join(Tag, Tag.id == TaskTag.tag_id)
        .where(TaskTag.task_id.in_(task_ids))
        .order_by(Tag.name.asc(), Tag.id.asc())
    )
    tags_by_task_id: dict[UUID, list[TagOut]] = {task_id: [] for task_id in task_ids}
    for task_id, tag in result.all():
        tags_by_task_id.setdefault(task_id, []).append(_to_tag_out(tag))
    return tags_by_task_id


async def replace_task_tags(
    session: AsyncSession,
    task: Task,
    tag_items: Iterable[TagInput],
) -> tuple[list[TagOut], bool]:
    desired_tags = await _resolve_tags_for_task(session, task, tag_items)
    desired_ids = {tag.id for tag in desired_tags}

    current_ids = set(
        await session.scalars(select(TaskTag.tag_id).where(TaskTag.task_id == task.id))
    )
    desired_names = [tag.name for tag in desired_tags]
    changed = current_ids != desired_ids or list(task.tags or []) != desired_names

    if changed:
        await session.execute(delete(TaskTag).where(TaskTag.task_id == task.id))
        for tag in desired_tags:
            session.add(TaskTag(task_id=task.id, tag_id=tag.id))
        task.tags = desired_names
        await session.flush()

    return [_to_tag_out(tag) for tag in desired_tags], changed


async def add_tag_name_to_task(
    session: AsyncSession,
    task: Task,
    tag_name: str,
) -> None:
    tags, _changed = await replace_task_tags(
        session,
        task,
        [*list(task.tags or []), tag_name],
    )
    task.tags = [tag.name for tag in tags]


async def _resolve_tags_for_task(
    session: AsyncSession,
    task: Task,
    tag_items: Iterable[TagInput],
) -> list[Tag]:
    items = list(tag_items)
    resolved: list[Tag] = []
    seen_ids: set[UUID] = set()
    seen_names: set[str] = set()
    tag_ids: list[UUID] = []
    tag_names: list[str] = []

    for item in items:
        if isinstance(item, str):
            name = _normalize_tag_name(item)
            if name is not None and name not in seen_names:
                seen_names.add(name)
                tag_names.append(name)
            continue

        if item.id not in seen_ids:
            seen_ids.add(item.id)
            tag_ids.append(item.id)

    tags_by_id: dict[UUID, Tag] = {}
    if tag_ids:
        result = await session.execute(select(Tag).where(Tag.id.in_(tag_ids)))
        tags_by_id = {tag.id: tag for tag in result.scalars().all()}
        if set(tag_ids) != set(tags_by_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="tag not found",
            )
        for tag in tags_by_id.values():
            if tag.board_id != task.board_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="tag not found",
                )

    tags_by_name: dict[str, Tag] = {}
    if tag_names:
        result = await session.execute(
            select(Tag).where(Tag.board_id == task.board_id, Tag.name.in_(tag_names))
        )
        tags_by_name = {tag.name: tag for tag in result.scalars().all()}
        for name in tag_names:
            if name not in tags_by_name:
                tag = Tag(board_id=task.board_id, name=name, color=DEFAULT_TAG_COLOR)
                session.add(tag)
                tags_by_name[name] = tag
        await session.flush()

    for item in items:
        if isinstance(item, str):
            name = _normalize_tag_name(item)
            if name is None:
                continue
            tag = tags_by_name[name]
        else:
            tag = tags_by_id[item.id]

        if tag.id not in seen_ids:
            seen_ids.add(tag.id)
            resolved.append(tag)
            continue
        if tag not in resolved:
            resolved.append(tag)

    return resolved


async def _get_board_or_404(session: AsyncSession, board_id: UUID) -> Board:
    board = await session.scalar(select(Board).where(Board.id == board_id))
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )
    return board


async def _get_task_or_404(session: AsyncSession, task_id: UUID) -> Task:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="task not found",
        )
    return task


async def _get_tag_or_404(session: AsyncSession, tag_id: UUID) -> Tag:
    tag = await session.scalar(select(Tag).where(Tag.id == tag_id))
    if tag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="tag not found",
        )
    return tag


async def _get_tasks_for_tag(session: AsyncSession, tag_id: UUID) -> list[Task]:
    result = await session.execute(
        select(Task).join(TaskTag, TaskTag.task_id == Task.id).where(TaskTag.tag_id == tag_id)
    )
    return list(result.scalars().all())


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


def _normalize_tag_name(name: str) -> str | None:
    normalized = name.strip()
    return normalized or None


def _append_legacy_tag(tags: list[str] | None, name: str) -> list[str]:
    current = list(tags or [])
    if name not in current:
        current.append(name)
    return current


def _remove_legacy_tag(tags: list[str] | None, name: str) -> list[str]:
    return [item for item in list(tags or []) if item != name]


def _to_tag_out(tag: Tag) -> TagOut:
    return TagOut(
        id=tag.id,
        board_id=tag.board_id,
        name=tag.name,
        color=tag.color,
    )
