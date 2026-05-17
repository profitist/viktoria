"""Add workspace deadline decay flag."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_000008"
down_revision = "20260518_000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column(
            "deadline_decay_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("workspaces", "deadline_decay_enabled")
