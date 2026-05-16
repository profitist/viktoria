from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.board.models import Board, Column
from app.board.schemas import (
    BoardOut,
    ColumnCreate,
    ColumnOut,
    ColumnPatch,
    ColumnReorder,
)
from app.tasks.schemas import TaskOut
from app.tasks.service import compute_deadline_urgency
from app.workspace.models import WorkspaceMember, WorkspaceRole

DEFAULT_COLUMNS = ("To Do", "In Progress", "Done")


async def get_or_create_board(
    session: AsyncSession,
    workspace_id: UUID,
) -> Board:
    created_or_changed = False
    board = await _get_board_by_workspace(session, workspace_id)
    if board is None:
        board = Board(workspace_id=workspace_id)
        session.add(board)
        await session.flush()
        created_or_changed = True

    if not board.columns:
        for position, name in enumerate(DEFAULT_COLUMNS):
            session.add(
                Column(
                    board_id=board.id,
                    name=name,
                    position=position,
                )
            )
        await session.flush()
        created_or_changed = True
        board = await _get_board_or_404(session, board.id)

    if created_or_changed:
        await session.commit()

    return board


async def get_board_with_columns(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> BoardOut:
    await _require_workspace_member(session, workspace_id, current_user.id)
    board = await get_or_create_board(session, workspace_id)
    return _build_board_out(board)


async def create_column(
    session: AsyncSession,
    board_id: UUID,
    payload: ColumnCreate,
    current_user: User,
) -> ColumnOut:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_admin(session, board.workspace_id, current_user.id)

    insert_position = _clamp_position(payload.position, len(board.columns))
    _shift_columns_for_insert(board.columns, insert_position)

    column = Column(
        board_id=board.id,
        name=payload.name,
        position=insert_position,
        color=payload.color,
    )
    session.add(column)
    await session.commit()
    await session.refresh(column)

    return ColumnOut(
        id=column.id,
        name=column.name,
        position=column.position,
        color=column.color,
        tasks=[],
    )


async def update_column(
    session: AsyncSession,
    column_id: UUID,
    payload: ColumnPatch,
    current_user: User,
) -> ColumnOut:
    column = await _get_column(session, column_id)
    await _require_workspace_admin(session, column.board.workspace_id, current_user.id)

    if "name" in payload.model_fields_set:
        column.name = payload.name
    if "color" in payload.model_fields_set:
        column.color = payload.color
    if "position" in payload.model_fields_set and payload.position is not None:
        _move_column(column.board.columns, column, payload.position)

    await session.commit()
    await session.refresh(column)

    return ColumnOut(
        id=column.id,
        name=column.name,
        position=column.position,
        color=column.color,
        tasks=[],
    )


async def delete_column(
    session: AsyncSession,
    column_id: UUID,
    current_user: User,
) -> None:
    column = await _get_column(session, column_id)
    await _require_workspace_admin(session, column.board.workspace_id, current_user.id)

    if column.tasks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="column has tasks",
        )

    remaining_columns = [item for item in column.board.columns if item.id != column.id]
    await session.delete(column)
    _normalize_column_positions(remaining_columns)
    await session.commit()


async def reorder_columns(
    session: AsyncSession,
    board_id: UUID,
    payload: ColumnReorder,
    current_user: User,
) -> None:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_admin(session, board.workspace_id, current_user.id)

    columns_by_id = {column.id: column for column in board.columns}
    for item in payload.columns:
        column = columns_by_id.get(item.id)
        if column is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="column not found",
            )
        column.position = item.position

    _normalize_column_positions(board.columns)
    await session.commit()


async def _require_workspace_admin(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    membership = await _require_workspace_member(session, workspace_id, user_id)
    if membership.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin access required",
        )
    return membership


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


async def _get_board_by_workspace(
    session: AsyncSession,
    workspace_id: UUID,
) -> Board | None:
    return await session.scalar(
        select(Board)
        .options(selectinload(Board.columns).selectinload(Column.tasks))
        .where(Board.workspace_id == workspace_id)
    )


async def _get_board_or_404(
    session: AsyncSession,
    board_id: UUID,
) -> Board:
    board = await session.scalar(
        select(Board)
        .options(selectinload(Board.columns).selectinload(Column.tasks))
        .where(Board.id == board_id)
    )
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )
    return board


async def _get_column(
    session: AsyncSession,
    column_id: UUID,
) -> Column:
    column = await session.scalar(
        select(Column)
        .options(
            selectinload(Column.board).selectinload(Board.columns),
            selectinload(Column.tasks),
        )
        .where(Column.id == column_id)
    )
    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="column not found",
        )
    return column


def _build_board_out(board: Board) -> BoardOut:
    return BoardOut(
        id=board.id,
        columns=[
            ColumnOut(
                id=column.id,
                name=column.name,
                position=column.position,
                color=column.color,
                tasks=[
                    TaskOut(
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
                    for task in sorted(column.tasks, key=lambda t: (t.created_at, t.id))
                ],
            )
            for column in sorted(board.columns, key=lambda item: item.position)
        ],
    )


def _clamp_position(position: int, max_position: int) -> int:
    if position < 0:
        return 0
    if position > max_position:
        return max_position
    return position


def _shift_columns_for_insert(columns: list[Column], insert_position: int) -> None:
    for column in columns:
        if column.position >= insert_position:
            column.position += 1


def _move_column(columns: list[Column], target_column: Column, new_position: int) -> None:
    ordered_columns = sorted(columns, key=lambda item: item.position)
    ordered_columns = [column for column in ordered_columns if column.id != target_column.id]
    target_position = _clamp_position(new_position, len(ordered_columns))
    ordered_columns.insert(target_position, target_column)

    for position, column in enumerate(ordered_columns):
        column.position = position


def _normalize_column_positions(columns: list[Column]) -> None:
    ordered_columns = sorted(columns, key=lambda item: (item.position, str(item.id)))
    for position, column in enumerate(ordered_columns):
        column.position = position
