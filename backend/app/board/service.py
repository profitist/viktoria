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
from app.workspace.models import WorkspaceMember, WorkspaceRole

DEFAULT_COLUMNS = [
    ("To Do", 0),
    ("In Progress", 1),
    ("Done", 2),
]


async def get_or_create_board(
    session: AsyncSession,
    workspace_id: UUID,
) -> Board:
    board = await session.scalar(
        select(Board)
        .options(
            selectinload(Board.columns),
        )
        .where(Board.workspace_id == workspace_id)
    )

    if board is None:
        board = Board(workspace_id=workspace_id)
        session.add(board)
        await session.flush()
    
    if not board.columns:
        for name, position in DEFAULT_COLUMNS:
            session.add(
                    Column(
                        board_id=board.id,
                        name=name,
                        position=position,
                        )
                    )

        await session.flush()

        board = await session.scalar(
            select(Board)
            .options(
                selectinload(Board.columns),
            )
            .where(Board.id == board.id)
        )

    return board


async def get_board_with_columns(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> BoardOut:
    await _require_workspace_member(
        session=session,
        workspace_id=workspace_id,
        user_id=current_user.id,
    )

    board = await get_or_create_board(
        session=session,
        workspace_id=workspace_id,
    )

    columns = [
        ColumnOut(
            id=column.id,
            name=column.name,
            position=column.position,
            color=column.color,
            tasks=[]
        )
        for column in sorted(board.columns, key=lambda c: c.position)
    ]

    return BoardOut(
        id=board.id,
        columns=columns,
    )


async def create_column(
    session: AsyncSession,
    board_id: UUID,
    payload: ColumnCreate,
    current_user: User,
) -> ColumnOut:
    board = await session.scalar(
        select(Board).where(Board.id == board_id)
    )

    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )

    await _require_workspace_admin(
        session=session,
        workspace_id=board.workspace_id,
        user_id=current_user.id,
    )

    column = Column(
        board_id=board_id,
        name=payload.name,
        position=payload.position,
        color=payload.color,
    )

    session.add(column)

    await session.commit()

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

    await _require_workspace_admin(
        session=session,
        workspace_id=column.board.workspace_id,
        user_id=current_user.id,
    )

    if payload.name is not None:
        column.name = payload.name

    if payload.position is not None:
        column.position = payload.position

    if payload.color is not None:
        column.color = payload.color

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

    await _require_workspace_admin(
        session=session,
        workspace_id=column.board.workspace_id,
        user_id=current_user.id,
    )

    if column.tasks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="column has tasks",
        )

    await session.delete(column)
    await session.commit()


async def reorder_columns(
    session: AsyncSession,
    board_id: UUID,
    payload: ColumnReorder,
    current_user: User,
) -> None:
    board = await session.scalar(
        select(Board)
        .options(selectinload(Board.columns))
        .where(Board.id == board_id)
    )

    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )

    await _require_workspace_admin(
        session=session,
        workspace_id=board.workspace_id,
        user_id=current_user.id,
    )

    columns_map = {
        column.id: column
        for column in board.columns
    }

    for item in payload.columns:
        column = columns_map.get(item.id)

        if column is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="column not found",
            )

        column.position = item.position

    await session.commit()


async def _require_workspace_admin(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    """
    Проверяет, что пользователь является admin/owner workspace.
    """

    membership = await _require_workspace_member(
        session=session,
        workspace_id=workspace_id,
        user_id=user_id,
    )

    if membership.role not in {
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
    }:
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


async def _get_column(
    session: AsyncSession,
    column_id: UUID,
) -> Column:
    column = await session.scalar(
        select(Column)
        .options(
            selectinload(Column.board),
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
