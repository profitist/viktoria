"""Add board_id to audit logs."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260518_000007"
down_revision = "20260518_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "audit_logs",
        "changes",
        server_default=sa.text("'[]'::jsonb"),
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
    )
    op.add_column(
        "audit_logs",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_audit_logs_board_id_boards"),
        "audit_logs",
        "boards",
        ["board_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_audit_logs_board_id"),
        "audit_logs",
        ["board_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_board_id"), table_name="audit_logs")
    op.drop_constraint(
        op.f("fk_audit_logs_board_id_boards"),
        "audit_logs",
        type_="foreignkey",
    )
    op.drop_column("audit_logs", "board_id")
    op.alter_column(
        "audit_logs",
        "changes",
        server_default=sa.text("'{}'::jsonb"),
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
    )
