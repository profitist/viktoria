from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.database import get_session
from app.tags.schemas import TagCreate, TagOut
from app.tags.service import (
    add_tag_to_task,
    create_tag,
    delete_tag,
    get_board_tags,
    remove_tag_from_task,
)

router = APIRouter(tags=["tags"])


@router.get(
    "/boards/{board_id}/tags",
    response_model=list[TagOut],
    status_code=status.HTTP_200_OK,
)
async def get_board_tags_route(
    board_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TagOut]:
    return await get_board_tags(
        session=session,
        board_id=board_id,
        current_user=current_user,
    )


@router.post(
    "/boards/{board_id}/tags",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag_route(
    board_id: UUID,
    payload: TagCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TagOut:
    return await create_tag(
        session=session,
        board_id=board_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete(
    "/boards/{board_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tag_route(
    board_id: UUID,
    tag_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await delete_tag(
        session=session,
        board_id=board_id,
        tag_id=tag_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/tasks/{task_id}/tags/{tag_id}",
    status_code=status.HTTP_200_OK,
)
async def add_tag_to_task_route(
    task_id: UUID,
    tag_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, bool]:
    await add_tag_to_task(
        session=session,
        task_id=task_id,
        tag_id=tag_id,
        current_user=current_user,
    )
    return {}


@router.delete(
    "/tasks/{task_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_tag_from_task_route(
    task_id: UUID,
    tag_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await remove_tag_from_task(
        session=session,
        task_id=task_id,
        tag_id=tag_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
