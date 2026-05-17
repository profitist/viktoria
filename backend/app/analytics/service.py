from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.models import BoardMetricSnapshot
from app.analytics.schemas import (
    AssigneeLoad,
    OverviewResponse,
    ProgressResponse,
    StatusCount,
    TrendPoint,
    WorkloadResponse,
)
from app.auth.models import User
from app.board.models import Column
from app.tasks.models import Task


async def get_overview(board_id: UUID, db: AsyncSession) -> OverviewResponse:
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

    by_status = [
        StatusCount(column_id=column_id, column_name=name, count=count)
        for column_id, name, count in result.all()
    ]
    return OverviewResponse(
        by_status=by_status,
        total=sum(status.count for status in by_status),
    )


async def get_progress(
    board_id: UUID,
    range_: Literal["week", "month"],
    db: AsyncSession,
) -> ProgressResponse:
    total, done = (
        await db.execute(
            select(
                func.count(Task.id),
                func.count(Task.id).filter(Column.name.ilike("done")),
            )
            .join(Column, Column.id == Task.column_id)
            .where(Task.board_id == board_id)
        )
    ).one()

    done_pct = 0.0 if total == 0 else min(max((done / total) * 100, 0.0), 100.0)

    return ProgressResponse(
        range=range_,
        done_pct=done_pct,
        trend=await _get_snapshot_trend(board_id, range_, db),
    )


async def get_workload(board_id: UUID, db: AsyncSession) -> WorkloadResponse:
    result = await db.execute(
        select(
            Task.assignee_id,
            User.name,
            func.count(Task.id).label("task_count"),
            func.count(Task.id).filter(Column.name.ilike("done")).label("done_count"),
        )
        .join(Column, Column.id == Task.column_id)
        .outerjoin(User, User.id == Task.assignee_id)
        .where(Task.board_id == board_id)
        .group_by(Task.assignee_id, User.name)
        .order_by(User.name.asc().nullsfirst(), Task.assignee_id.asc().nullsfirst())
    )

    return WorkloadResponse(
        by_assignee=[
            AssigneeLoad(
                assignee_id=assignee_id,
                name=name if assignee_id is not None else "Unassigned",
                count=count,
                done=done,
            )
            for assignee_id, name, count, done in result.all()
        ]
    )


async def _get_snapshot_trend(
    board_id: UUID,
    range_: Literal["week", "month"],
    db: AsyncSession,
) -> list[TrendPoint]:
    days = 7 if range_ == "week" else 30
    now = datetime.now(UTC)
    start_date = now.date() - timedelta(days=days - 1)
    start_at = datetime.combine(start_date, time.min, tzinfo=UTC)

    result = await db.execute(
        select(BoardMetricSnapshot)
        .where(
            BoardMetricSnapshot.board_id == board_id,
            BoardMetricSnapshot.captured_at >= start_at,
            BoardMetricSnapshot.captured_at <= now,
        )
        .order_by(
            BoardMetricSnapshot.captured_at.asc(),
            BoardMetricSnapshot.id.asc(),
        )
    )

    latest_by_day: dict[date, BoardMetricSnapshot] = {}
    for snapshot in result.scalars():
        latest_by_day[snapshot.captured_at.date()] = snapshot

    return [
        TrendPoint(
            date=day,
            done=snapshot.done_tasks,
            total=snapshot.total_tasks,
        )
        for day, snapshot in sorted(latest_by_day.items())
    ]
