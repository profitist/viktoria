from __future__ import annotations

import logging

from fastapi import WebSocket

from app.notifications.jsonrpc import CONNECTED, build

_logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Singleton менеджер WebSocket-соединений.

    Хранит активные соединения в виде {workspace_id: [WebSocket, ...]}.
    Один пользователь с несколькими вкладками = несколько соединений под одним workspace_id.
    Thread-safe для asyncio (однопоточная event loop).
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, workspace_id: str, websocket: WebSocket) -> None:
        """
        Принимает соединение и регистрирует его.

        Отправляет Greeting после accept. Исключения не перехватывает — fail-fast.
        """
        await websocket.accept()
        self._connections.setdefault(workspace_id, []).append(websocket)
        greeting = build(CONNECTED, {
            "workspace_id": workspace_id,
            "message": f"Connected to workspace {workspace_id}",
        })
        await websocket.send_json(greeting)

    def disconnect(self, workspace_id: str, websocket: WebSocket) -> None:
        """
        Удаляет соединение из реестра. Синхронный — вызывается из finally и broadcast.

        Idempotent: если workspace_id отсутствует — молча возвращает.
        Не вызывает websocket.close() — FastAPI закроет сам после выхода из endpoint.
        """
        if workspace_id not in self._connections:
            return
        connections = self._connections[workspace_id]
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            del self._connections[workspace_id]

    async def broadcast(self, workspace_id: str, message: dict) -> None:
        """
        Рассылает message всем клиентам workspace.

        Итерирует по копии списка — защита от модификации во время итерации.
        Ошибка отдельного клиента не прерывает рассылку для остальных.
        """
        if workspace_id not in self._connections:
            return
        for websocket in list(self._connections[workspace_id]):
            try:
                await websocket.send_json(message)
            except Exception as exc:
                _logger.warning(
                    "Failed to send message to websocket in workspace %s, disconnecting: %s",
                    workspace_id,
                    exc,
                )
                self.disconnect(workspace_id, websocket)

    def connection_count(self, workspace_id: str) -> int:
        """Возвращает количество активных соединений для workspace."""
        return len(self._connections.get(workspace_id, []))


# Singleton уровня модуля — импортируется напрямую.
manager = ConnectionManager()
