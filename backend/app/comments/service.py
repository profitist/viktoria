from __future__ import annotations

import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.comments.models import Comment
from app.notifications.service import create_notification
from app.tasks.models import Task
from app.workspace.models import WorkspaceMember, WorkspaceRole


async def list_comments(session: AsyncSession, task_id: UUID) -> list[Comment]:
    result = await session.execute(
        select(Comment)
        .where(Comment.task_id == task_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.desc(), Comment.id.desc())
    )
    return list(result.scalars().all())


async def create_comment(
    session: AsyncSession,
    task_id: UUID,
    author_id: UUID,
    body: str,
) -> Comment:
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")

    workspace_id = task.workspace_id

    mentioned_names = list({n.lower() for n in re.findall(r"@(\w+)", body, re.IGNORECASE)})

    mention_ids: list[UUID] = []
    if mentioned_names:
        rows = await session.execute(
            select(User.id)
            .join(WorkspaceMember, User.id == WorkspaceMember.user_id)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                func.lower(User.name).in_(mentioned_names),
            )
        )
        mention_ids = list(rows.scalars().all())

    comment = Comment(
        task_id=task_id,
        author_id=author_id,
        body=body,
        mentions=[str(uid) for uid in mention_ids],
    )
    session.add(comment)
    await session.flush()

    author_result = await session.get(User, author_id)
    author_name = author_result.name if author_result else "Someone"

    for uid in mention_ids:
        if uid != author_id:
            await create_notification(
                session=session,
                user_id=uid,
                workspace_id=workspace_id,
                message=f"@{author_name} упомянул вас в комментарии",
                event_type="mention",
                data={"comment_id": str(comment.id), "task_id": str(task_id)},
            )

    await session.commit()

    result = await session.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.author))
    )
    return result.scalar_one()


async def delete_comment(
    session: AsyncSession,
    comment_id: UUID,
    actor: User,
) -> None:
    result = await session.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="comment not found")

    if comment.author_id != actor.id:
        task = await session.get(Task, comment.task_id)
        role_result = await session.execute(
            select(WorkspaceMember.role).where(
                WorkspaceMember.workspace_id == task.workspace_id,
                WorkspaceMember.user_id == actor.id,
            )
        )
        role = role_result.scalar_one_or_none()
        if role not in (WorkspaceRole.ADMIN, WorkspaceRole.OWNER):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")

    await session.delete(comment)
    await session.commit()
