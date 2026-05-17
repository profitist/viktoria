"""Import all ORM models so SQLAlchemy metadata is fully populated."""

from app.attachments.models import Attachment
from app.analytics.models import BoardMetricSnapshot
from app.audit.models import AuditLog
from app.auth.models import User
from app.comments.models import Comment
from app.automation.models import AutomationRule
from app.board.models import Board, BoardFavorite, Column, Project
from app.events.models import ProcessedEvent
from app.notifications.models import Notification
from app.tags.models import Tag, TaskTag
from app.tasks.models import DeadlineUrgency, Subtask, Task, TaskPriority
from app.workspace.models import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceSettings

__all__ = [
    "Attachment",
    "BoardMetricSnapshot",
    "AuditLog",
    "Comment",
    "AutomationRule",
    "Board",
    "BoardFavorite",
    "Column",
    "DeadlineUrgency",
    "Notification",
    "ProcessedEvent",
    "Project",
    "Subtask",
    "Tag",
    "Task",
    "TaskTag",
    "TaskPriority",
    "User",
    "Workspace",
    "WorkspaceMember",
    "WorkspaceRole",
    "WorkspaceSettings",
]
