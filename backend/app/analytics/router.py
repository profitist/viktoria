from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.schemas import OverviewResponse, ProgressResponse, WorkloadResponse
from app.analytics.service import get_overview, get_progress, get_workload
from app.auth.deps import get_current_user
from app.auth.models import User
from app.board.models import Board
from app.database import get_session
from app.workspace.models import WorkspaceMember

router = APIRouter(prefix="/api/v1/boards/{board_id}/analytics", tags=["analytics"])

ProgressRange = Literal["week", "month"]


@router.get(
    "/overview",
    response_model=OverviewResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics_overview_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> OverviewResponse:
    await _require_board_member(session, board_id, current_user.id)
    return await get_overview(board_id, session)


@router.get(
    "/progress",
    response_model=ProgressResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics_progress_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    range: ProgressRange = "week",
) -> ProgressResponse:
    await _require_board_member(session, board_id, current_user.id)
    return await get_progress(board_id, range, session)


@router.get(
    "/workload",
    response_model=WorkloadResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics_workload_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkloadResponse:
    await _require_board_member(session, board_id, current_user.id)
    return await get_workload(board_id, session)


async def _require_board_member(
    session: AsyncSession,
    board_id: UUID,
    user_id: UUID,
) -> Board:
    board = await session.scalar(select(Board).where(Board.id == board_id))
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )

    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == board.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="board not found",
        )
    return board
