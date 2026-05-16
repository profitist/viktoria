from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


DEFAULT_TAG_COLOR = "#6B7280"


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("board_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DEFAULT_TAG_COLOR,
        server_default=text(f"'{DEFAULT_TAG_COLOR}'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    board = relationship("Board")
    task_links = relationship(
        "TaskTag",
        back_populates="tag",
        cascade="all, delete-orphan",
    )


class TaskTag(Base):
    __tablename__ = "task_tags"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    task = relationship("Task")
    tag = relationship("Tag", back_populates="task_links")
