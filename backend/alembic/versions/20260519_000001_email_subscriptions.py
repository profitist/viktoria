"""Add email subscriptions."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260519_000001"
down_revision = "20260518_000010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_subscriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_email_subscriptions_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_email_subscriptions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_email_subscriptions_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_subscriptions")),
    )
    op.create_index(
        op.f("ix_email_subscriptions_event_type"),
        "email_subscriptions",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_subscriptions_task_id"),
        "email_subscriptions",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_subscriptions_user_id"),
        "email_subscriptions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_subscriptions_workspace_id"),
        "email_subscriptions",
        ["workspace_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_email_subscriptions_workspace_id"), table_name="email_subscriptions")
    op.drop_index(op.f("ix_email_subscriptions_user_id"), table_name="email_subscriptions")
    op.drop_index(op.f("ix_email_subscriptions_task_id"), table_name="email_subscriptions")
    op.drop_index(op.f("ix_email_subscriptions_event_type"), table_name="email_subscriptions")
    op.drop_table("email_subscriptions")
