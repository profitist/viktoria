from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.models import User
from app.board.models import Board, Column
from app.database import get_session
from app.tasks.models import Task, TaskPriority
from app.workspace.models import WorkspaceMember
from app.workspace.schemas import (
    MemberInvite,
    MemberOut,
    MyTaskSchema,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)
from app.workspace.service import (
    add_member,
    create_workspace,
    get_workspace,
    list_members,
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


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    workspace = await get_workspace(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )
    return WorkspaceResponse(workspace=workspace)


@router.get(
    "/{workspace_id}/me/tasks",
    response_model=list[MyTaskSchema],
    status_code=status.HTTP_200_OK,
)
async def get_my_tasks(
    workspace_id: UUID,
    view: Literal["mine", "others"] = Query(default="mine"),
    sort: Literal["priority", "-priority", "deadline", "-deadline", "assignee"] = Query(
        default="-priority"
    ),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[MyTaskSchema]:
    membership = await db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="workspace access required",
        )

    is_done = Column.name.ilike("done")
    stmt = (
        select(
            Task.id.label("id"),
            Task.title.label("title"),
            Task.priority.label("priority"),
            Task.deadline.label("deadline"),
            Task.deadline_urgency.label("deadline_urgency"),
            Task.assignee_id.label("assignee_id"),
            User.name.label("assignee_name"),
            Board.id.label("board_id"),
            Board.name.label("board_name"),
            Task.column_id.label("column_id"),
            Column.name.label("column_name"),
            is_done.label("is_done"),
        )
        .join(Column, Column.id == Task.column_id)
        .join(Board, Board.id == Column.board_id)
        .outerjoin(User, User.id == Task.assignee_id)
        .where(
            Task.workspace_id == workspace_id,
            Task.board_id == Board.id,
            Board.workspace_id == workspace_id,
        )
    )

    if view == "mine":
        stmt = stmt.where(Task.assignee_id == current_user.id)
    else:
        stmt = stmt.where(
            Task.assignee_id.is_not(None),
            Task.assignee_id != current_user.id,
        )

    search_term = search.strip() if search is not None else ""
    if search_term:
        stmt = stmt.where(Task.title.ilike(f"%{search_term}%"))

    stmt = stmt.order_by(*_my_tasks_order_by(sort))
    result = await db.execute(stmt)

    return [
        MyTaskSchema(
            id=row.id,
            title=row.title,
            priority=_string_value(row.priority),
            deadline=row.deadline,
            deadline_urgency=_string_value(row.deadline_urgency),
            assignee_id=row.assignee_id,
            assignee_name=row.assignee_name,
            board_id=row.board_id,
            board_name=row.board_name,
            column_id=row.column_id,
            column_name=row.column_name,
            is_done=bool(row.is_done),
        )
        for row in result.all()
    ]


@router.get(
    "/{workspace_id}/members",
    response_model=list[MemberOut],
    status_code=status.HTTP_200_OK,
)
async def list_members_route(
    workspace_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[MemberOut]:
    return await list_members(
        session=session,
        workspace_id=workspace_id,
        current_user=current_user,
    )


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


def _my_tasks_order_by(sort: str) -> list[Any]:
    if sort == "priority":
        return [_priority_order_expression().asc(), Task.id.asc()]
    if sort == "-priority":
        return [_priority_order_expression().desc(), Task.id.asc()]
    if sort == "deadline":
        return [Task.deadline.asc().nullslast(), Task.id.asc()]
    if sort == "-deadline":
        return [Task.deadline.desc().nullslast(), Task.id.asc()]
    if sort == "assignee":
        return [User.name.asc().nullslast(), Task.id.asc()]

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="invalid sort",
    )


def _priority_order_expression() -> Any:
    return case(
        *(
            (Task.priority == priority, index)
            for index, priority in enumerate(TaskPriority)
        ),
        else_=0,
    )


def _string_value(value: object) -> str:
    return str(getattr(value, "value", value))
