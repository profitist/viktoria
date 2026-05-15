from __future__ import annotations

from typing import Final

# Методы JSON-RPC 2.0 — единственное место определения строк.
CONNECTED: Final[str] = "connection.established"
TASK_CREATED: Final[str] = "board.task_created"
TASK_UPDATED: Final[str] = "board.task_updated"
TASK_MOVED: Final[str] = "board.task_moved"
TASK_DELETED: Final[str] = "board.task_deleted"
NOTIFICATION_CREATED: Final[str] = "notification.created"
EVENT_LOG_ENTRY: Final[str] = "event_log.entry"


def build(method: str, params: dict) -> dict:
    """
    Собирает JSON-RPC 2.0 notification.

    Возвращает dict — сериализацию в JSON делает FastAPI через send_json().
    Чистая функция без побочных эффектов.
    """
    return {"jsonrpc": "2.0", "method": method, "params": params}
