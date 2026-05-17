from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.audit.models import AuditLog
from app.audit.schemas import AuditChangeItem, AuditLogOut
from app.auth.deps import get_current_user
from app.auth.models import User
from app.auth.schemas import UserOut
from app.database import get_session
from app.workspace.models import WorkspaceMember, WorkspaceRole

router = APIRouter(tags=["audit"])


@router.get(
    "/workspaces/{workspace_id}/audit-log",
    response_model=list[AuditLogOut],
    status_code=status.HTTP_200_OK,
)
async def get_audit_log(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    event_type: list[str] | None = Query(default=None),
    board_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLogOut]:
    await _require_workspace_admin(session, workspace_id, current_user.id)

    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.actor), selectinload(AuditLog.task))
        .where(AuditLog.workspace_id == workspace_id)
    )
    if event_type:
        stmt = stmt.where(AuditLog.event_type.in_(event_type))
    if board_id is not None:
        stmt = stmt.where(AuditLog.board_id == board_id)
    stmt = (
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(stmt)
    return [_to_audit_log_out(entry) for entry in result.scalars().all()]


async def _require_workspace_admin(
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
    if membership.role not in {WorkspaceRole.OWNER, WorkspaceRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin access required",
        )
    return membership


def _to_audit_log_out(entry: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=entry.id,
        event_type=entry.event_type,
        actor=UserOut.model_validate(entry.actor),
        task_id=entry.task_id,
        task_title=entry.task.title if entry.task is not None else None,
        changes=_normalize_changes(entry.changes),
        created_at=entry.created_at,
    )


def _normalize_changes(value: Any) -> list[AuditChangeItem]:
    if isinstance(value, list):
        return [
            AuditChangeItem(
                field=str(item.get("field", "")),
                old=item.get("old"),
                new=item.get("new"),
            )
            for item in value
            if isinstance(item, dict)
        ]
    if isinstance(value, dict):
        return [
            AuditChangeItem(field=str(field), old=None, new=new_value)
            for field, new_value in value.items()
        ]
    return []
