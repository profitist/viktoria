from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.models import BoardMetricSnapshot
from app.board.models import Board, Column
from app.database import AsyncSessionLocal
from app.tasks.models import Task

SNAPSHOT_INTERVAL_SECONDS = 3600

logger = logging.getLogger("analytics.snapshot")


async def take_snapshot(db: AsyncSession) -> None:
    board_ids = list(await db.scalars(select(Board.id).order_by(Board.id.asc())))
    saved_count = 0

    for board_id in board_ids:
        try:
            total_tasks, done_tasks = await _get_task_counts(db, board_id)
            by_status = await _get_status_counts(db, board_id)
            db.add(
                BoardMetricSnapshot(
                    board_id=board_id,
                    captured_at=datetime.now(UTC),
                    total_tasks=total_tasks,
                    done_tasks=done_tasks,
                    by_status=by_status,
                )
            )
            await db.commit()
            saved_count += 1
        except Exception:
            await db.rollback()
            logger.exception("failed to take snapshot for board %s", board_id)

    logger.info("snapshot taken for %s boards", saved_count)


async def snapshot_loop() -> None:
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
        logger.info("starting analytics snapshot cycle")
        try:
            async with AsyncSessionLocal() as db:
                await take_snapshot(db)
        except Exception:
            logger.exception("analytics snapshot cycle failed")


async def _get_task_counts(db: AsyncSession, board_id: UUID) -> tuple[int, int]:
    total_tasks, done_tasks = (
        await db.execute(
            select(
                func.count(Task.id),
                func.count(Task.id).filter(Column.name.ilike("done")),
            )
            .join(Column, Column.id == Task.column_id)
            .where(Task.board_id == board_id)
        )
    ).one()
    return total_tasks, done_tasks


async def _get_status_counts(
    db: AsyncSession,
    board_id: UUID,
) -> list[dict[str, int | str]]:
    result = await db.execute(
        select(
            Column.id,
            Column.name,
            func.count(Task.id).label("task_count"),
        )
        .outerjoin(Task, Task.column_id == Column.id)
        .where(Column.board_id == board_id)
        .group_by(Column.id, Column.name, Column.position)
        .order_by(Column.position.asc(), Column.id.asc())
    )

    return [
        {
            "column_id": str(column_id),
            "column_name": column_name,
            "count": task_count,
        }
        for column_id, column_name, task_count in result.all()
    ]
