from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.board.models import Board, BoardFavorite, Column, Project
from app.board.schemas import (
    BoardCreatedOut,
    BoardCreate,
    BoardDetail,
    BoardOut,
    BoardListItem,
    BoardPatch,
    ColumnCreate,
    ColumnOut,
    ColumnPatch,
    ColumnReorder,
    FavoriteResponse,
)
from app.tasks.models import Subtask, Task
from app.tasks.schemas import SubtaskProgress, TaskOut
from app.tasks.service import (
    compute_deadline_days_remaining,
    compute_deadline_urgency,
)
from app.tags.schemas import TagOut
from app.tags.service import get_task_tags_by_task_id
from app.workspace.models import WorkspaceMember, WorkspaceRole

DEFAULT_COLUMNS = ("To Do", "In Progress", "Done")


async def get_or_create_board(
    session: AsyncSession,
    workspace_id: UUID,
) -> Board:
    created_or_changed = False
    board = await _get_board_by_workspace(session, workspace_id)
    if board is None:
        board = Board(workspace_id=workspace_id, name="Main")
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
    tags_by_task_id = await _get_board_task_tags(session, board)
    return _build_board_out(board, tags_by_task_id)


async def list_boards(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> list[BoardListItem]:
    await _require_workspace_member(session, workspace_id, current_user.id)

    result = await session.execute(
        select(Board)
        .where(Board.workspace_id == workspace_id)
        .order_by(Board.created_at.asc(), Board.id.asc())
    )
    boards = result.scalars().all()
    favorite_ids = await _get_favorite_board_ids(session, current_user.id, workspace_id)
    return [_build_board_list_item(board, favorite_ids) for board in boards]


async def create_board(
    session: AsyncSession,
    workspace_id: UUID,
    payload: BoardCreate,
    current_user: User,
) -> BoardCreatedOut:
    await _require_workspace_admin(session, workspace_id, current_user.id)
    await _validate_project(session, workspace_id, payload.project_id)

    board = Board(
        workspace_id=workspace_id,
        name=payload.name,
        description=payload.description,
        project_id=payload.project_id,
    )
    session.add(board)
    await session.flush()

    for position, name in enumerate(DEFAULT_COLUMNS):
        session.add(Column(board_id=board.id, name=name, position=position))

    await session.commit()
    await session.refresh(board)
    return _build_board_created_out(board)


async def get_board(
    session: AsyncSession,
    board_id: UUID,
    current_user: User,
) -> BoardDetail:
    board = await _get_board_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)
    is_favorite = await _is_favorite(session, current_user.id, board.id)
    tags_by_task_id = await _get_board_task_tags(session, board)
    return _build_board_detail(board, is_favorite, tags_by_task_id)


async def patch_board(
    session: AsyncSession,
    board_id: UUID,
    payload: BoardPatch,
    current_user: User,
) -> BoardDetail:
    board = await _get_board_basic_or_404(session, board_id)
    await _require_workspace_admin(session, board.workspace_id, current_user.id)

    if "name" in payload.model_fields_set:
        if payload.name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="name cannot be null",
            )
        board.name = payload.name

    if "description" in payload.model_fields_set:
        board.description = payload.description

    if "project_id" in payload.model_fields_set:
        await _validate_project(session, board.workspace_id, payload.project_id)
        board.project_id = payload.project_id

    await session.commit()

    reloaded_board = await _get_board_or_404(session, board.id)
    is_favorite = await _is_favorite(session, current_user.id, board.id)
    tags_by_task_id = await _get_board_task_tags(session, reloaded_board)
    return _build_board_detail(reloaded_board, is_favorite, tags_by_task_id)


async def delete_board(
    session: AsyncSession,
    board_id: UUID,
    current_user: User,
) -> None:
    board = await _get_board_basic_or_404(session, board_id)
    await _require_workspace_admin(session, board.workspace_id, current_user.id)

    board_count = await session.scalar(
        select(func.count(Board.id)).where(Board.workspace_id == board.workspace_id)
    )
    if board_count is None or board_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="cannot delete last board",
        )

    column_ids = await session.scalars(select(Column.id).where(Column.board_id == board.id))
    ids = list(column_ids)
    if ids:
        await session.execute(delete(Task).where(Task.column_id.in_(ids)))

    await session.delete(board)
    await session.commit()


async def set_favorite(
    session: AsyncSession,
    board_id: UUID,
    current_user: User,
) -> FavoriteResponse:
    board = await _get_board_basic_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)

    existing = await session.scalar(
        select(BoardFavorite).where(
            BoardFavorite.user_id == current_user.id,
            BoardFavorite.board_id == board.id,
        )
    )
    if existing is None:
        session.add(BoardFavorite(user_id=current_user.id, board_id=board.id))
        await session.commit()

    return FavoriteResponse(is_favorite=True)


async def unset_favorite(
    session: AsyncSession,
    board_id: UUID,
    current_user: User,
) -> None:
    board = await _get_board_basic_or_404(session, board_id)
    await _require_workspace_member(session, board.workspace_id, current_user.id)

    favorite = await session.scalar(
        select(BoardFavorite).where(
            BoardFavorite.user_id == current_user.id,
            BoardFavorite.board_id == board.id,
        )
    )
    if favorite is not None:
        await session.delete(favorite)
        await session.commit()


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
        .options(
            selectinload(Board.columns)
            .selectinload(Column.tasks)
            .selectinload(Task.subtasks)
        )
        .where(Board.workspace_id == workspace_id)
        .order_by(Board.created_at.asc(), Board.id.asc())
    )


async def _get_board_basic_or_404(
    session: AsyncSession,
    board_id: UUID,
) -> Board:
    board = await session.scalar(select(Board).where(Board.id == board_id))
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )
    return board


async def _get_board_or_404(
    session: AsyncSession,
    board_id: UUID,
) -> Board:
    board = await session.scalar(
        select(Board)
        .options(
            selectinload(Board.columns)
            .selectinload(Column.tasks)
            .selectinload(Task.subtasks)
        )
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


async def _validate_project(
    session: AsyncSession,
    workspace_id: UUID,
    project_id: UUID | None,
) -> None:
    if project_id is None:
        return

    project = await session.scalar(
        select(Project.id).where(
            Project.id == project_id,
            Project.workspace_id == workspace_id,
        )
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        )


async def _get_favorite_board_ids(
    session: AsyncSession,
    user_id: UUID,
    workspace_id: UUID,
) -> set[UUID]:
    result = await session.execute(
        select(BoardFavorite.board_id)
        .join(Board, Board.id == BoardFavorite.board_id)
        .where(
            BoardFavorite.user_id == user_id,
            Board.workspace_id == workspace_id,
        )
    )
    return set(result.scalars().all())


async def _is_favorite(
    session: AsyncSession,
    user_id: UUID,
    board_id: UUID,
) -> bool:
    favorite = await session.scalar(
        select(BoardFavorite.board_id).where(
            BoardFavorite.user_id == user_id,
            BoardFavorite.board_id == board_id,
        )
    )
    return favorite is not None


def _build_board_created_out(board: Board) -> BoardCreatedOut:
    return BoardCreatedOut(
        id=board.id,
        name=board.name,
        description=board.description,
        project_id=board.project_id,
    )


def _build_board_list_item(board: Board, favorite_ids: set[UUID]) -> BoardListItem:
    return BoardListItem(
        id=board.id,
        name=board.name,
        description=board.description,
        project_id=board.project_id,
        is_favorite=board.id in favorite_ids,
    )


async def _get_board_task_tags(
    session: AsyncSession,
    board: Board,
) -> dict[UUID, list[TagOut]]:
    task_ids = [
        task.id
        for column in board.columns
        for task in column.tasks
    ]
    return await get_task_tags_by_task_id(session, task_ids)


def _build_board_detail(
    board: Board,
    is_favorite: bool,
    tags_by_task_id: dict[UUID, list[TagOut]],
) -> BoardDetail:
    board_out = _build_board_out(board, tags_by_task_id)
    return BoardDetail(
        id=board.id,
        name=board.name,
        description=board.description,
        project_id=board.project_id,
        is_favorite=is_favorite,
        columns=board_out.columns,
    )


def _build_board_out(
    board: Board,
    tags_by_task_id: dict[UUID, list[TagOut]],
) -> BoardOut:
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
                        board_id=task.board_id,
                        workspace_id=task.workspace_id,
                        priority=task.priority.value,
                        tags=tags_by_task_id.get(task.id, []),
                        assignee_id=task.assignee_id,
                        created_at=task.created_at,
                        deadline=task.deadline,
                        deadline_days_remaining=compute_deadline_days_remaining(
                            task.deadline
                        ),
                        deadline_urgency=compute_deadline_urgency(task.deadline),
                        subtask_progress=SubtaskProgress(
                            done_count=sum(1 for st in task.subtasks if st.is_done),
                            total_count=len(task.subtasks),
                        ),
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
