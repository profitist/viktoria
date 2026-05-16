from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.automation.schemas import (
    AutomationRuleCreate,
    AutomationRuleOut,
    AutomationRulePatch,
)
from app.automation.service import create_rule, delete_rule, list_rules, update_rule
from app.database import get_session

router = APIRouter(tags=["automation"])


@router.post(
    "/workspaces/{workspace_id}/automation",
    response_model=AutomationRuleOut,
    status_code=status.HTTP_200_OK,
)
async def create_rule_route(
    workspace_id: UUID,
    payload: AutomationRuleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationRuleOut:
    rule = await create_rule(
        session=session,
        workspace_id=workspace_id,
        payload=payload,
        current_user=current_user,
    )
    return AutomationRuleOut.model_validate(rule)


@router.get(
    "/workspaces/{workspace_id}/automation",
    response_model=list[AutomationRuleOut],
    status_code=status.HTTP_200_OK,
)
async def list_rules_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[AutomationRuleOut]:
    rules = await list_rules(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )
    return [AutomationRuleOut.model_validate(rule) for rule in rules]


@router.patch(
    "/automation/{rule_id}",
    response_model=AutomationRuleOut,
    status_code=status.HTTP_200_OK,
)
async def update_rule_route(
    rule_id: UUID,
    payload: AutomationRulePatch,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationRuleOut:
    rule = await update_rule(
        session=session,
        rule_id=rule_id,
        payload=payload,
        current_user=current_user,
    )
    return AutomationRuleOut.model_validate(rule)


@router.delete(
    "/automation/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rule_route(
    rule_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await delete_rule(
        session=session,
        rule_id=rule_id,
        current_user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
