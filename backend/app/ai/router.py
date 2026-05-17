from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError

from app.ai.groom import complete_grooming, start_grooming
from app.auth.deps import get_current_user
from app.auth.models import User

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
