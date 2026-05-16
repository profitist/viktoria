from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.comments.schemas import CommentCreate, CommentResponse
from app.comments.service import create_comment, delete_comment, list_comments
from app.database import get_session

router = APIRouter(tags=["comments"])


@router.get(
    "/tasks/{task_id}/comments",
    response_model=list[CommentResponse],
    status_code=status.HTTP_200_OK,
)
async def get_comments(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CommentResponse]:
    comments = await list_comments(session=session, task_id=task_id)
    return [CommentResponse.model_validate(c) for c in comments]


@router.post(
    "/tasks/{task_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_comment(
    task_id: UUID,
    payload: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CommentResponse:
    comment = await create_comment(
        session=session,
        task_id=task_id,
        author_id=current_user.id,
        body=payload.body,
    )
    return CommentResponse.model_validate(comment)


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_comment(
    comment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await delete_comment(session=session, comment_id=comment_id, actor=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
