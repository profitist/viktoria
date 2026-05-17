"""Add board metric snapshots."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260518_000006"
down_revision = "20260517_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "board_metric_snapshot",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("captured_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("total_tasks", sa.Integer(), nullable=False),
        sa.Column("done_tasks", sa.Integer(), nullable=False),
        sa.Column(
            "by_status",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["board_id"],
            ["boards.id"],
            name=op.f("fk_board_metric_snapshot_board_id_boards"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_board_metric_snapshot")),
    )
    op.create_index(
        "ix_board_metric_snapshot_board_captured",
        "board_metric_snapshot",
        ["board_id", sa.text("captured_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_board_metric_snapshot_board_captured",
        table_name="board_metric_snapshot",
    )
    op.drop_table("board_metric_snapshot")
