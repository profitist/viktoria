from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DeadlineUrgency(str, enum.Enum):
    NONE = "none"
    SOON = "soon"
    CRITICAL = "critical"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("columns.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(
            TaskPriority,
            name="task_priority",
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String()),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    deadline: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    deadline_urgency: Mapped[DeadlineUrgency] = mapped_column(
        Enum(
            DeadlineUrgency,
            name="deadline_urgency",
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
        server_default=text("'none'"),
    )

    column = relationship("Column", back_populates="tasks")
    workspace = relationship("Workspace", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks")
    audit_logs = relationship("AuditLog", back_populates="task")
