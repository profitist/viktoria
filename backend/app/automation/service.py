from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.automation.models import AutomationRule
from app.automation.schemas import AutomationRuleCreate, AutomationRulePatch
from app.workspace.models import WorkspaceMember, WorkspaceRole


async def create_rule(
    session: AsyncSession,
    workspace_id: UUID,
    payload: AutomationRuleCreate,
    current_user: User,
) -> AutomationRule:
    await _require_workspace_owner(session, workspace_id, current_user.id)

    rule = AutomationRule(
        workspace_id=workspace_id,
        name=payload.name,
        trigger=payload.trigger,
        condition=_dump_optional_json(payload.condition),
        action=payload.action.model_dump(mode="json"),
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


async def list_rules(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
) -> list[AutomationRule]:
    await _require_workspace_member(session, workspace_id, current_user.id)

    result = await session.execute(
        select(AutomationRule)
        .where(AutomationRule.workspace_id == workspace_id)
        .order_by(AutomationRule.name.asc(), AutomationRule.id.asc())
    )
    return list(result.scalars().all())


async def update_rule(
    session: AsyncSession,
    rule_id: UUID,
    payload: AutomationRulePatch,
    current_user: User,
) -> AutomationRule:
    rule = await _get_rule_or_404(session, rule_id)
    await _require_rule_workspace_owner(session, rule.workspace_id, current_user.id)

    if "name" in payload.model_fields_set and payload.name is not None:
        rule.name = payload.name
    if "trigger" in payload.model_fields_set and payload.trigger is not None:
        rule.trigger = payload.trigger
    if "condition" in payload.model_fields_set:
        rule.condition = _dump_optional_json(payload.condition)
    if "action" in payload.model_fields_set and payload.action is not None:
        rule.action = payload.action.model_dump(mode="json")
    if "active" in payload.model_fields_set and payload.active is not None:
        rule.active = payload.active

    await session.commit()
    await session.refresh(rule)
    return rule


async def delete_rule(
    session: AsyncSession,
    rule_id: UUID,
    current_user: User,
) -> None:
    rule = await _get_rule_or_404(session, rule_id)
    await _require_rule_workspace_owner(session, rule.workspace_id, current_user.id)

    await session.delete(rule)
    await session.commit()


async def _get_rule_or_404(
    session: AsyncSession,
    rule_id: UUID,
) -> AutomationRule:
    rule = await session.scalar(
        select(AutomationRule).where(AutomationRule.id == rule_id)
    )
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="automation rule not found",
        )
    return rule


async def _require_workspace_member(
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


async def _require_workspace_owner(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember:
    membership = await _require_workspace_member(session, workspace_id, user_id)
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="owner access required",
        )
    return membership


async def _require_rule_workspace_owner(
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
            detail="automation rule not found",
        )
    if membership.role != WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="owner access required",
        )
    return membership


def _dump_optional_json(value: object | None) -> dict | None:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return value
    raise TypeError("value must be a pydantic model, dict, or None")
