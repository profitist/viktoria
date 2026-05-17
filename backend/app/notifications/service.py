from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.database import AsyncSessionLocal
from app.notifications.email import send_email
from app.notifications.models import EmailSubscription, Notification
from app.tasks.models import Task
from app.workspace.models import WorkspaceMember


class NotificationNotFound(Exception):
    """Уведомление не найдено или не принадлежит пользователю."""


TASK_ASSIGNED_EVENT = "task.assigned"
COMMENT_CREATED_EVENT = "comment.created"


async def subscribe(
    user_id: UUID,
    workspace_id: UUID,
    event_type: str,
    task_id: UUID | None = None,
) -> EmailSubscription:
    event_type = event_type.strip()
    if not event_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="event_type is required",
        )

    async with AsyncSessionLocal() as session:
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

        if task_id is not None:
            task_workspace_id = await session.scalar(
                select(Task.workspace_id).where(Task.id == task_id)
            )
            if task_workspace_id != workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="task not found",
                )

        task_filter = (
            EmailSubscription.task_id.is_(None)
            if task_id is None
            else EmailSubscription.task_id == task_id
        )

        existing = await session.scalar(
            select(EmailSubscription).where(
                EmailSubscription.user_id == user_id,
                EmailSubscription.workspace_id == workspace_id,
                EmailSubscription.event_type == event_type,
                task_filter,
            )
        )
        if existing is not None:
            return existing

        subscription = EmailSubscription(
            user_id=user_id,
            workspace_id=workspace_id,
            event_type=event_type,
            task_id=task_id,
        )
        session.add(subscription)
        await session.commit()
        await session.refresh(subscription)
        return subscription


async def get_subscribers(task_id: UUID, event_type: str) -> list[User]:
    async with AsyncSessionLocal() as session:
        workspace_id = await session.scalar(
            select(Task.workspace_id).where(Task.id == task_id)
        )
        if workspace_id is None:
            return []

        subscribed_user_ids = (
            select(EmailSubscription.user_id)
            .where(
                EmailSubscription.workspace_id == workspace_id,
                EmailSubscription.event_type == event_type,
                or_(
                    EmailSubscription.task_id.is_(None),
                    EmailSubscription.task_id == task_id,
                ),
            )
            .distinct()
        )
        result = await session.execute(
            select(User)
            .where(User.id.in_(subscribed_user_ids))
            .order_by(User.email.asc(), User.id.asc())
        )
        return list(result.scalars().all())


async def notify_assigned(task: Any, assignee: Any) -> None:
    subscribers = await get_subscribers(task.id, TASK_ASSIGNED_EVENT)
    if not subscribers:
        return

    task_title = getattr(task, "title", "Untitled task")
    assignee_name = getattr(assignee, "name", "Unknown assignee")
    subject = f"Task assigned: {task_title}"
    body = f"{assignee_name} was assigned to task '{task_title}'."

    for subscriber in subscribers:
        await send_email(subscriber.email, subject, body)


async def notify_comment(task: Any, comment: Any, author: Any) -> None:
    subscribers = await get_subscribers(task.id, COMMENT_CREATED_EVENT)
    if not subscribers:
        return

    task_title = getattr(task, "title", "Untitled task")
    author_name = getattr(author, "name", "Unknown author")
    comment_body = getattr(comment, "body", "")
    subject = f"New comment: {task_title}"
    body = f"{author_name} commented on task '{task_title}':\n\n{comment_body}"

    for subscriber in subscribers:
        await send_email(subscriber.email, subject, body)


async def create_notification(
    session: AsyncSession,
    user_id: UUID,
    workspace_id: UUID,
    message: str,
    event_type: str,
    data: dict[str, Any] | None = None,
) -> Notification:
    notification_data = deepcopy(data) if data is not None else {}
    notification = Notification(
        user_id=user_id,
        workspace_id=workspace_id,
        message=message,
        type=event_type,
        data=notification_data,
    )
    session.add(notification)
    await session.flush()
    return notification


async def create_notifications_for_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    message: str,
    event_type: str,
    data: dict[str, Any] | None = None,
) -> list[Notification]:
    result = await session.execute(
        select(WorkspaceMember.user_id).where(WorkspaceMember.workspace_id == workspace_id)
    )
    user_ids = result.scalars().all()

    notifications = [
        Notification(
            user_id=user_id,
            workspace_id=workspace_id,
            message=message,
            type=event_type,
            data=deepcopy(data) if data is not None else {},
        )
        for user_id in user_ids
    ]
    session.add_all(notifications)
    if notifications:
        await session.flush()
    return notifications


async def get_notifications(
    session: AsyncSession,
    user_id: UUID,
    workspace_id: UUID,
    unread_only: bool = False,
) -> list[Notification]:
    """
    Возвращает уведомления пользователя в workspace, отсортированные по убыванию даты.

    Если unread_only=True — возвращает только непрочитанные.
    """
    stmt = (
        select(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.workspace_id == workspace_id,
        )
        .order_by(Notification.created_at.desc())
    )
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def mark_as_read(
    session: AsyncSession,
    notification_id: UUID,
    user_id: UUID,
) -> Notification:
    """
    Помечает уведомление прочитанным.

    Выбрасывает NotificationNotFound если уведомление не найдено или принадлежит другому пользователю.
    """
    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()

    if notification is None:
        raise NotificationNotFound(f"Notification {notification_id} not found")

    notification.read = True
    await session.commit()
    await session.refresh(notification)
    return notification
