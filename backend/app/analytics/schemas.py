from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class StatusCount(BaseModel):
    column_id: UUID
    column_name: str
    count: int


class OverviewResponse(BaseModel):
    by_status: list[StatusCount]
    total: int


class TrendPoint(BaseModel):
    date: date
    done: int
    total: int


class ProgressResponse(BaseModel):
    range: str
    done_pct: float
    trend: list[TrendPoint]


class AssigneeLoad(BaseModel):
    assignee_id: UUID | None
    name: str | None
    count: int
    done: int


class WorkloadResponse(BaseModel):
    by_assignee: list[AssigneeLoad]
