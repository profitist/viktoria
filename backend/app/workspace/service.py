from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.board.models import Board
from app.workspace.models import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceSettings
from app.workspace.schemas import (
    MemberInvite,
    MemberOut,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)


async def create_workspace(
    session: AsyncSession,
    payload: WorkspaceCreate,
    current_user: User,
) -> WorkspaceOut:
    existing_workspace = await session.scalar(
        select(Workspace.id).where(Workspace.slug == payload.slug)
    )
    if existing_workspace is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="workspace slug already exists",
        )

    workspace = Workspace(name=payload.name, slug=payload.slug)
    session.add(workspace)
    await session.flush()

    session.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=current_user.id,
            role=WorkspaceRole.OWNER,
        )
    )
    session.add(WorkspaceSettings(workspace_id=workspace.id))
    session.add(Board(workspace_id=workspace.id))

    await session.commit()

    return WorkspaceOut(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        role=WorkspaceRole.OWNER.value,
    )


async def get_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> WorkspaceOut:
    membership = await _get_membership(session, workspace_id, current_user.id)
    return WorkspaceOut(
        id=membership.workspace.id,
        name=membership.workspace.name,
        slug=membership.workspace.slug,
        role=membership.role.value,
    )


async def list_user_workspaces(
    session: AsyncSession,
    current_user: User,
) -> list[WorkspaceOut]:
    result = await session.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.workspace))
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(WorkspaceMember.joined_at.desc())
    )
    memberships = result.scalars().all()
    return [
        WorkspaceOut(
            id=membership.workspace.id,
            name=membership.workspace.name,
            slug=membership.workspace.slug,
            role=membership.role.value,
        )
        for membership in memberships
    ]


async def list_members(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> list[MemberOut]:
    await _require_member(session, workspace_id, current_user.id)

    result = await session.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc(), WorkspaceMember.user_id.asc())
    )
    memberships = result.scalars().all()

    return [
        MemberOut(
            user_id=membership.user_id,
            email=membership.user.email,
            name=membership.user.name,
            role=membership.role.value,
            joined_at=membership.joined_at,
        )
        for membership in memberships
    ]


async def add_member(
    session: AsyncSession,
    workspace_id: UUID,
    payload: MemberInvite,
    current_user: User,
) -> MemberOut:
    await _require_admin(session, workspace_id, current_user.id)

    invited_user = await session.scalar(
        select(User).where(User.email == payload.email)
    )
    if invited_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )

    existing_membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == invited_user.id,
        )
    )
    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="user is already a workspace member",
        )

    membership = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=invited_user.id,
        role=WorkspaceRole(payload.role),
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)

    return MemberOut(
        user_id=invited_user.id,
        email=invited_user.email,
        name=invited_user.name,
        role=membership.role.value,
        joined_at=membership.joined_at,
    )


async def remove_member(
    session: AsyncSession,
    workspace_id: UUID,
    member_user_id: UUID,
    current_user: User,
) -> None:
    await _require_admin(session, workspace_id, current_user.id)

    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == member_user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace member not found",
        )
    if membership.role == WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="workspace owner cannot be removed",
        )

    await session.delete(membership)
    await session.commit()


async def update_settings(
    session: AsyncSession,
    workspace_id: UUID,
    payload: WorkspaceSettingsPatch,
    current_user: User,
) -> WorkspaceSettingsOut:
    membership = await _require_admin(session, workspace_id, current_user.id)
    settings = membership.workspace.settings
    if settings is None:
        settings = WorkspaceSettings(workspace_id=workspace_id)
        session.add(settings)
        await session.flush()

    if payload.automation_enabled is not None:
        settings.automation_enabled = payload.automation_enabled

    await session.commit()
    await session.refresh(settings)
    return WorkspaceSettingsOut.model_validate(settings)


async def _get_membership(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    membership = await session.scalar(
        select(WorkspaceMember)
        .options(
            selectinload(WorkspaceMember.workspace).selectinload(Workspace.settings),
        )
        .where(
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


async def _require_member(
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="workspace access required",
        )
    return membership


async def _require_admin(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    membership = await _get_membership(session, workspace_id, user_id)
    if membership.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin access required",
        )
    return membership
