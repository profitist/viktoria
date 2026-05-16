from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.database import get_session
from app.workspace.schemas import (
    MemberInvite,
    MemberOut,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)
from app.workspace.service import (
    add_member,
    create_workspace,
    list_user_workspaces,
    remove_member,
    update_settings,
)

router = APIRouter(prefix="/workspaces", tags=["workspace"])


class WorkspaceResponse(BaseModel):
    workspace: WorkspaceOut


class MemberResponse(BaseModel):
    member: MemberOut


class WorkspaceSettingsResponse(BaseModel):
    settings: WorkspaceSettingsOut


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_200_OK)
async def create_workspace_route(
    payload: WorkspaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    workspace = await create_workspace(
        session=session,
        payload=payload,
        current_user=current_user,
    )
    return WorkspaceResponse(workspace=workspace)


@router.get("/me", response_model=list[WorkspaceOut], status_code=status.HTTP_200_OK)
async def list_my_workspaces_route(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkspaceOut]:
    return await list_user_workspaces(session=session, current_user=current_user)


@router.post(
    "/{workspace_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_200_OK,
)
async def add_member_route(
    workspace_id: UUID,
    payload: MemberInvite,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MemberResponse:
    member = await add_member(
        session=session,
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
    )
    return MemberResponse(member=member)


@router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member_route(
    workspace_id: UUID,
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await remove_member(
        session=session,
        workspace_id=workspace_id,
        member_user_id=user_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{workspace_id}/settings",
    response_model=WorkspaceSettingsResponse,
    status_code=status.HTTP_200_OK,
)
async def update_settings_route(
    workspace_id: UUID,
    payload: WorkspaceSettingsPatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceSettingsResponse:
    settings = await update_settings(
        session=session,
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
    )
    return WorkspaceSettingsResponse(settings=settings)
