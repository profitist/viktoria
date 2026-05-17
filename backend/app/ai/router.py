from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.groom import call_llm, complete_grooming, start_grooming
from app.auth.deps import get_current_user
from app.auth.models import User
from app.comments.models import Comment
from app.database import get_session
from app.tasks.models import Task
from app.workspace.models import WorkspaceMember

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class GroomStartRequest(BaseModel):
    problem_description: str = Field(min_length=1)
    workspace_id: UUID


class Question(BaseModel):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)


class GroomStartResponse(BaseModel):
    session_id: UUID
    questions: list[Question]


class AnswerItem(BaseModel):
    question_id: str = Field(min_length=1)
    answer: str = Field(min_length=1)


class GroomCompleteRequest(BaseModel):
    session_id: UUID
    answers: list[AnswerItem]
    problem_description: str = Field(min_length=1)


class TaskDraft(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    priority: str = Field(pattern="^(low|medium|high|critical)$")
    tags: list[str]


class GroomCompleteResponse(BaseModel):
    task_draft: TaskDraft


class TaskSummaryRequest(BaseModel):
    task_id: UUID


class TaskSummaryResponse(BaseModel):
    summary: str = Field(min_length=1)


@router.post(
    "/groom/start",
    response_model=GroomStartResponse,
    status_code=status.HTTP_200_OK,
)
async def groom_start(
    body: GroomStartRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> GroomStartResponse:
    _ = current_user
    try:
        result = await start_grooming(body.problem_description)
        questions = [Question(**question) for question in result["questions"]]
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="invalid llm response",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="llm timeout",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="llm request failed",
        ) from exc

    return GroomStartResponse(
        session_id=uuid4(),
        questions=questions,
    )


@router.post(
    "/groom/complete",
    response_model=GroomCompleteResponse,
    status_code=status.HTTP_200_OK,
)
async def groom_complete(
    body: GroomCompleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> GroomCompleteResponse:
    _ = current_user
    try:
        result = await complete_grooming(
            body.problem_description,
            [answer.model_dump() for answer in body.answers],
        )
        task_draft = TaskDraft(**result)
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="invalid llm response",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="llm timeout",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="llm request failed",
        ) from exc

    return GroomCompleteResponse(task_draft=task_draft)


@router.post(
    "/summarize-task",
    response_model=TaskSummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def summarize_task(
    body: TaskSummaryRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskSummaryResponse:
    task = await session.get(Task, body.task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="task not found",
        )

    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == task.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="task not found",
        )

    result = await session.execute(
        select(Comment)
        .where(Comment.task_id == task.id)
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .limit(20)
    )
    comments = list(result.scalars().all())
    comments.reverse()

    try:
        llm_result = await call_llm(
            system=(
                "You summarize tasks for collaborators. "
                "Return JSON only in the shape {\"summary\": \"...\"}. "
                "Write the summary in the main language of the task content. "
                "Keep it to 2-3 sentences and focus on the task goal, current state, and key discussion points."
            ),
            user_message=_build_summary_prompt(task, comments),
        )
        summary = TaskSummaryResponse(**llm_result)
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="invalid llm response",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="llm timeout",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="llm request failed",
        ) from exc

    return summary


def _build_summary_prompt(task: Task, comments: list[Comment]) -> str:
    description = task.description.strip() or "No description"
    if comments:
        comments_text = "\n".join(
            f"{index}. {comment.body.strip() or '[empty comment]'}"
            for index, comment in enumerate(comments, start=1)
        )
    else:
        comments_text = "No comments"

    return (
        "Summarize this task in 2-3 sentences. "
        "Keep the output in the same language as the task content.\n\n"
        f"Title: {task.title}\n"
        f"Description: {description}\n"
        f"Comments:\n{comments_text}"
    )
