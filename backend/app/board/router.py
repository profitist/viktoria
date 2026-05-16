from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.board.schemas import (
    BoardCreatedResponse,
    BoardCreate,
    BoardDetailResponse,
    BoardListItem,
    BoardPatch,
    BoardResponse,
    ColumnCreate,
    ColumnPatch,
    ColumnReorder,
    ColumnResponse,
    FavoriteResponse,
)
from app.board.service import (
    create_board,
    create_column,
    delete_board,
    delete_column,
    get_board,
    get_board_with_columns,
    list_boards,
    patch_board,
    reorder_columns,
    set_favorite,
    unset_favorite,
    update_column,
)
from app.database import get_session

router = APIRouter(tags=["board"])


@router.get(
    "/workspaces/{workspace_id}/boards",
    response_model=list[BoardListItem],
    status_code=status.HTTP_200_OK,
)
async def list_boards_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BoardListItem]:
    return await list_boards(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )


@router.post(
    "/workspaces/{workspace_id}/boards",
    response_model=BoardCreatedResponse,
    status_code=status.HTTP_200_OK,
)
async def create_board_route(
    workspace_id: UUID,
    payload: BoardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BoardCreatedResponse:
    board = await create_board(
        session=session,
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
    )
    return BoardCreatedResponse(board=board)


@router.get(
    "/workspaces/{workspace_id}/board",
    response_model=BoardResponse,
    status_code=status.HTTP_200_OK,
)
async def get_board_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BoardResponse:
    """
    Получить доску workspace вместе со всеми колонками.

    При первом обращении автоматически создаются:
    - To Do
    - In Progress
    - Done
    """

    board = await get_board_with_columns(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )

    return BoardResponse(board=board)


@router.get(
    "/boards/{board_id}",
    response_model=BoardDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def get_board_by_id_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BoardDetailResponse:
    board = await get_board(
        session=session,
        board_id=board_id,
        current_user=current_user,
    )
    return BoardDetailResponse(board=board)


@router.patch(
    "/boards/{board_id}",
    response_model=BoardDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_board_route(
    board_id: UUID,
    payload: BoardPatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BoardDetailResponse:
    board = await patch_board(
        session=session,
        board_id=board_id,
        payload=payload,
        current_user=current_user,
    )
    return BoardDetailResponse(board=board)


@router.delete(
    "/boards/{board_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_board_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await delete_board(
        session=session,
        board_id=board_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/boards/{board_id}/favorite",
    response_model=FavoriteResponse,
    status_code=status.HTTP_200_OK,
)
async def set_favorite_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FavoriteResponse:
    return await set_favorite(
        session=session,
        board_id=board_id,
        current_user=current_user,
    )


@router.delete(
    "/boards/{board_id}/favorite",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unset_favorite_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await unset_favorite(
        session=session,
        board_id=board_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/boards/{board_id}/columns",
    response_model=ColumnResponse,
    status_code=status.HTTP_200_OK,
)
async def create_column_route(
    board_id: UUID,
    payload: ColumnCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ColumnResponse:
    """
    Создать новую колонку на доске.
    """

    column = await create_column(
        session=session,
        board_id=board_id,
        payload=payload,
        current_user=current_user,
    )

    return ColumnResponse(column=column)


@router.patch(
    "/columns/{column_id}",
    response_model=ColumnResponse,
    status_code=status.HTTP_200_OK,
)
async def update_column_route(
    column_id: UUID,
    payload: ColumnPatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ColumnResponse:
    """
    Частично обновить колонку.
    """

    column = await update_column(
        session=session,
        column_id=column_id,
        payload=payload,
        current_user=current_user,
    )

    return ColumnResponse(column=column)


@router.delete(
    "/columns/{column_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_column_route(
    column_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    """
    Удалить колонку.

    Колонка не может быть удалена,
    если в ней есть задачи.
    """

    await delete_column(
        session=session,
        column_id=column_id,
        current_user=current_user,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/boards/{board_id}/columns/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reorder_columns_route(
    board_id: UUID,
    payload: ColumnReorder,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    """
    Массово обновить порядок колонок на доске.
    """

    await reorder_columns(
        session=session,
        board_id=board_id,
        payload=payload,
        current_user=current_user,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
