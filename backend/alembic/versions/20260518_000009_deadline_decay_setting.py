"""Add deadline decay workspace setting."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_000009"
down_revision = "20260518_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspace_settings",
        sa.Column(
            "deadline_decay_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("workspace_settings", "deadline_decay_enabled")
