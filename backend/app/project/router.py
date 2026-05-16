from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.database import get_session
from app.project.schemas import ProjectCreate, ProjectOut, ProjectPatch
from app.project.service import (
    create_project,
    delete_project,
    list_projects,
    patch_project,
)

router = APIRouter(tags=["project"])


class ProjectResponse(BaseModel):
    project: ProjectOut


@router.get(
    "/workspaces/{workspace_id}/projects",
    response_model=list[ProjectOut],
    status_code=status.HTTP_200_OK,
)
async def list_projects_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectOut]:
    return await list_projects(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )


@router.post(
    "/workspaces/{workspace_id}/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
async def create_project_route(
    workspace_id: UUID,
    payload: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectResponse:
    project = await create_project(
        session=session,
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
    )
    return ProjectResponse(project=project)


@router.patch(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_project_route(
    project_id: UUID,
    payload: ProjectPatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectResponse:
    project = await patch_project(
        session=session,
        project_id=project_id,
        payload=payload,
        current_user=current_user,
    )
    return ProjectResponse(project=project)


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_project_route(
    project_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await delete_project(
        session=session,
        project_id=project_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
