"""Add done flag to task."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260518_000010"
down_revision = "20260518_000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "done",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("tasks", "done")
