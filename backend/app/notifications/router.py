from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import InvalidToken, decode_token, get_current_user
from app.auth.models import User
from app.database import AsyncSessionLocal, get_session
from app.notifications.hub import manager
from app.notifications.models import Notification
from app.notifications.schemas import (
    NotificationListQuery,
    NotificationOut,
    ReadResponse,
    SubscribeRequest,
    SubscribeResponse,
)
from app.notifications.service import (
    NotificationNotFound,
    get_notifications,
    mark_as_read,
    subscribe,
)
from app.workspace.models import WorkspaceMember

ws_router = APIRouter()
router = APIRouter(tags=["notifications"])


@ws_router.websocket("/ws/{workspace_id}")
async def websocket_endpoint(
    workspace_id: UUID,
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint для real-time уведомлений.

    Жизненный цикл: валидация токена → проверка членства → accept + greeting → receive loop → disconnect.
    Невалидный токен или отсутствие членства → accept() → close(4001) → return.
    Сессия БД создаётся вручную только для шага авторизации и закрывается сразу после.
    """
    # Шаг 1: валидация токена
    try:
        user_id = decode_token(token)
    except InvalidToken:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    # Шаг 2: проверка членства в workspace — сессия живёт только в этом блоке
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        is_member = result.scalar_one_or_none() is not None

    if not is_member:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    # Шаг 3-6: connect + receive loop + guaranteed cleanup
    # manager.connect внутри try — disconnect вызывается даже если greeting упал
    try:
        await manager.connect(str(workspace_id), websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(str(workspace_id), websocket)


@router.get(
    "/notifications",
    response_model=list[NotificationOut],
    status_code=200,
)
async def list_notifications(
    query: Annotated[NotificationListQuery, Depends()],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[NotificationOut]:
    """
    Возвращает список уведомлений пользователя для указанного workspace.

    Пустой список — норма при отсутствии уведомлений, не 404.
    """
    notifications = await get_notifications(
        session=session,
        user_id=current_user.id,
        workspace_id=query.workspace_id,
        unread_only=query.unread is True,
    )
    return [NotificationOut.model_validate(n) for n in notifications]


@router.post(
    "/notifications/subscribe",
    response_model=SubscribeResponse,
    status_code=201,
)
async def subscribe_notifications(
    payload: SubscribeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubscribeResponse:
    subscription = await subscribe(
        user_id=current_user.id,
        workspace_id=payload.workspace_id,
        event_type=payload.event_type,
        task_id=payload.task_id,
    )
    return SubscribeResponse(
        id=subscription.id,
        workspace_id=subscription.workspace_id,
        event_type=subscription.event_type,
        task_id=subscription.task_id,
    )


@router.patch(
    "/notifications/read-all",
    status_code=200,
)
async def mark_all_notifications_read(
    workspace_id: Annotated[UUID, Query(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    """
    Помечает все непрочитанные уведомления текущего пользователя в workspace прочитанными.
    """
    await session.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.workspace_id == workspace_id,
            Notification.read.is_(False),
        )
        .values(read=True)
    )
    await session.commit()
    return {}


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=ReadResponse,
    status_code=200,
)
async def mark_notification_read(
    notification_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReadResponse:
    """
    Помечает уведомление прочитанным.

    404 если уведомление не найдено или принадлежит другому пользователю.
    """
    try:
        await mark_as_read(
            session=session,
            notification_id=notification_id,
            user_id=current_user.id,
        )
    except NotificationNotFound:
        raise HTTPException(status_code=404, detail="Notification not found")

    return ReadResponse()
