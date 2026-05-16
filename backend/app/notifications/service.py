from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.models import Notification
from app.workspace.models import WorkspaceMember


class NotificationNotFound(Exception):
    """Уведомление не найдено или не принадлежит пользователю."""


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
