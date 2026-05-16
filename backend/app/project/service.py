from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.board.models import Board, Project
from app.project.schemas import ProjectCreate, ProjectOut, ProjectPatch
from app.workspace.models import WorkspaceMember, WorkspaceRole


async def list_projects(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> list[ProjectOut]:
    await _require_member(session, workspace_id, current_user.id)

    rows = await session.execute(
        select(Project, func.count(Board.id).label("board_count"))
        .outerjoin(Board, Board.project_id == Project.id)
        .where(Project.workspace_id == workspace_id)
        .group_by(Project.id)
        .order_by(Project.created_at.asc())
    )
    return [
        ProjectOut(id=row.Project.id, name=row.Project.name, board_count=row.board_count)
        for row in rows
    ]


async def create_project(
    session: AsyncSession,
    workspace_id: UUID,
    payload: ProjectCreate,
    current_user: User,
) -> ProjectOut:
    await _require_admin(session, workspace_id, current_user.id)

    project = Project(workspace_id=workspace_id, name=payload.name)
    session.add(project)
    await session.commit()
    await session.refresh(project)

    return ProjectOut(id=project.id, name=project.name, board_count=0)


async def patch_project(
    session: AsyncSession,
    project_id: UUID,
    payload: ProjectPatch,
    current_user: User,
) -> ProjectOut:
    project = await _get_project_or_404(session, project_id)
    await _require_admin(session, project.workspace_id, current_user.id)

    if payload.name is not None:
        project.name = payload.name

    await session.commit()
    await session.refresh(project)

    board_count = await session.scalar(
        select(func.count(Board.id)).where(Board.project_id == project.id)
    )
    return ProjectOut(id=project.id, name=project.name, board_count=board_count or 0)


async def delete_project(
    session: AsyncSession,
    project_id: UUID,
    current_user: User,
) -> None:
    project = await _get_project_or_404(session, project_id)
    await _require_admin(session, project.workspace_id, current_user.id)

    # Доски не удаляются — только открепляются от проекта
    await session.execute(
        update(Board).where(Board.project_id == project_id).values(project_id=None)
    )
    await session.delete(project)
    await session.commit()


async def _get_project_or_404(session: AsyncSession, project_id: UUID) -> Project:
    project = await session.scalar(select(Project).where(Project.id == project_id))
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return project


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
    membership = await _require_member(session, workspace_id, user_id)
    if membership.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin access required",
        )
    return membership
