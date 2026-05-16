"""Multi-board: projects, board name/description/project_id, board_favorites, task.board_id."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260516_000003"
down_revision = "20260516_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Снять ограничение «один board на workspace» — теперь их может быть несколько
    op.drop_constraint("uq_boards_workspace_id", "boards", type_="unique")

    # 2. boards.name: nullable → backfill → NOT NULL
    op.add_column("boards", sa.Column("name", sa.String(length=255), nullable=True))

    # 3. boards.description: опциональное описание доски
    op.add_column("boards", sa.Column("description", sa.Text(), nullable=True))

    # 4. Новая таблица projects (группировка досок внутри workspace)
    op.create_table(
        "projects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_projects_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(
        op.f("ix_projects_workspace_id"), "projects", ["workspace_id"], unique=False
    )

    # 5. boards.project_id: nullable FK — доска может не принадлежать проекту
    op.add_column(
        "boards",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_boards_project_id_projects"),
        "boards",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 6. tasks.board_id: денормализация для быстрой фильтрации задач по доске
    op.add_column(
        "tasks",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 7. board_favorites: закреплённые доски пользователя
    op.create_table(
        "board_favorites",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["board_id"],
            ["boards.id"],
            name=op.f("fk_board_favorites_board_id_boards"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_board_favorites_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("board_id", "user_id", name=op.f("pk_board_favorites")),
    )

    # 8. Backfill: у каждого workspace уже ровно одна доска — называем её «Main»
    op.execute("UPDATE boards SET name = 'Main' WHERE name IS NULL")

    # 9. Backfill tasks.board_id через column → board (tasks уже знают column_id)
    op.execute(
        """
        UPDATE tasks t
        SET board_id = c.board_id
        FROM columns c
        WHERE t.column_id = c.id
        """
    )

    # 10. После backfill — ставим NOT NULL
    op.alter_column("boards", "name", nullable=False)
    op.alter_column("tasks", "board_id", nullable=False)

    # 11. FK tasks.board_id → boards.id
    op.create_foreign_key(
        op.f("fk_tasks_board_id_boards"),
        "tasks",
        "boards",
        ["board_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 12. Индексы для типичных запросов (списки досок workspace, задачи по доске)
    op.create_index(op.f("ix_boards_workspace_id"), "boards", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_tasks_board_id"), "tasks", ["board_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_board_id"), table_name="tasks")
    op.drop_index(op.f("ix_boards_workspace_id"), table_name="boards")

    op.drop_constraint(op.f("fk_tasks_board_id_boards"), "tasks", type_="foreignkey")
    op.drop_column("tasks", "board_id")

    op.drop_table("board_favorites")

    op.drop_constraint(op.f("fk_boards_project_id_projects"), "boards", type_="foreignkey")
    op.drop_column("boards", "project_id")

    op.drop_index(op.f("ix_projects_workspace_id"), table_name="projects")
    op.drop_table("projects")

    op.drop_column("boards", "description")
    op.drop_column("boards", "name")

    # Восстанавливаем ограничение один-к-одному (безопасно только если не создавались лишние доски)
    op.create_unique_constraint("uq_boards_workspace_id", "boards", ["workspace_id"])
