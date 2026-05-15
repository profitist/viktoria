"""Import all ORM models so SQLAlchemy metadata is fully populated."""

from app.audit.models import AuditLog
from app.auth.models import User
from app.automation.models import AutomationRule
from app.board.models import Board, Column
from app.notifications.models import Notification
from app.tasks.models import DeadlineUrgency, Task, TaskPriority
from app.workspace.models import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceSettings

__all__ = [
    "AuditLog",
    "AutomationRule",
    "Board",
    "Column",
    "DeadlineUrgency",
    "Notification",
    "Task",
    "TaskPriority",
    "User",
    "Workspace",
    "WorkspaceMember",
    "WorkspaceRole",
    "WorkspaceSettings",
]
