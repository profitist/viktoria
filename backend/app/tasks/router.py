from __future__ import annotations

from typing import Annotated
from uuid import UUID

from aio_pika.abc import AbstractChannel
from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.database import get_session
from app.events.publisher import get_channel
from app.tasks.schemas import TaskCreate, TaskMoveRequest, TaskOut, TaskPatch
from app.tasks.service import (
    DuplicateTaskError,
    create_task,
    delete_task,
    get_task,
    list_tasks,
    move_task,
    update_task,
)

router = APIRouter(tags=["tasks"])


class TaskResponse(BaseModel):
    task: TaskOut


def _duplicate_task_response(exc: DuplicateTaskError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": "task already exists",
            "existing_task_id": str(exc.existing_task_id),
        },
    )


async def _get_publish_channel(request: Request) -> AbstractChannel:
    return await get_channel(request.app)


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_200_OK)
async def create_task_route(
    payload: TaskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    channel: Annotated[AbstractChannel, Depends(_get_publish_channel)],
) -> TaskResponse | JSONResponse:
    try:
        task = await create_task(
            session=session,
            payload=payload,
            current_user=current_user,
            channel=channel,
        )
    except DuplicateTaskError as exc:
        return _duplicate_task_response(exc)

    return TaskResponse(task=task)


@router.get("/tasks/{task_id}", response_model=TaskResponse, status_code=status.HTTP_200_OK)
async def get_task_route(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskResponse:
    task = await get_task(
        session=session,
        task_id=task_id,
        current_user=current_user,
    )
    return TaskResponse(task=task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse, status_code=status.HTTP_200_OK)
async def update_task_route(
    task_id: UUID,
    payload: TaskPatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    channel: Annotated[AbstractChannel, Depends(_get_publish_channel)],
) -> TaskResponse | JSONResponse:
    try:
        task = await update_task(
            session=session,
            task_id=task_id,
            payload=payload,
            current_user=current_user,
            channel=channel,
        )
    except DuplicateTaskError as exc:
        return _duplicate_task_response(exc)

    return TaskResponse(task=task)


@router.put(
    "/tasks/{task_id}/move",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def move_task_route(
    task_id: UUID,
    payload: TaskMoveRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    channel: Annotated[AbstractChannel, Depends(_get_publish_channel)],
) -> TaskResponse:
    task = await move_task(
        session=session,
        task_id=task_id,
        payload=payload,
        current_user=current_user,
        channel=channel,
    )
    return TaskResponse(task=task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_route(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    channel: Annotated[AbstractChannel, Depends(_get_publish_channel)],
) -> Response:
    await delete_task(
        session=session,
        task_id=task_id,
        current_user=current_user,
        channel=channel,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/workspaces/{workspace_id}/tasks",
    response_model=list[TaskOut],
    status_code=status.HTTP_200_OK,
)
async def list_tasks_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    column_id: UUID | None = Query(default=None),
    assignee_id: UUID | None = Query(default=None),
    tag: str | None = Query(default=None),
) -> list[TaskOut]:
    return await list_tasks(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
        column_id=column_id,
        assignee_id=assignee_id,
        tag=tag,
    )
