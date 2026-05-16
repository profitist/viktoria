"""Add normalized tags and subtasks."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260517_000004"
down_revision = "20260516_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "color",
            sa.String(length=32),
            server_default=sa.text("'#6B7280'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["board_id"],
            ["boards.id"],
            name=op.f("fk_tags_board_id_boards"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("board_id", "name", name=op.f("uq_tags_board_id_name")),
    )
    op.create_index(op.f("ix_tags_board_id"), "tags", ["board_id"], unique=False)

    op.create_table(
        "task_tags",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
            name=op.f("fk_task_tags_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_task_tags_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("task_id", "tag_id", name=op.f("pk_task_tags")),
    )
    op.create_index(op.f("ix_task_tags_tag_id"), "task_tags", ["tag_id"], unique=False)

    op.create_table(
        "subtask",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "is_done",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_subtask_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subtask")),
    )
    op.create_index(op.f("ix_subtask_task_id"), "subtask", ["task_id"], unique=False)

    op.execute(
        """
        INSERT INTO tags (board_id, name)
        SELECT DISTINCT t.board_id, btrim(expanded.name)
        FROM tasks AS t
        CROSS JOIN LATERAL unnest(t.tags) AS expanded(name)
        WHERE btrim(expanded.name) != ''
        ON CONFLICT (board_id, name) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO task_tags (task_id, tag_id)
        SELECT DISTINCT t.id, tag.id
        FROM tasks AS t
        CROSS JOIN LATERAL unnest(t.tags) AS expanded(name)
        JOIN tags AS tag
          ON tag.board_id = t.board_id
         AND tag.name = btrim(expanded.name)
        WHERE btrim(expanded.name) != ''
        ON CONFLICT (task_id, tag_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_subtask_task_id"), table_name="subtask")
    op.drop_table("subtask")

    op.drop_index(op.f("ix_task_tags_tag_id"), table_name="task_tags")
    op.drop_table("task_tags")

    op.drop_index(op.f("ix_tags_board_id"), table_name="tags")
    op.drop_table("tags")
