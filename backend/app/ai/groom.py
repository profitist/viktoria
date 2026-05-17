from __future__ import annotations

import json
from json import JSONDecodeError
from typing import Any

import httpx

from app.config import settings

GROOM_START_SYSTEM = """
Ты — помощник по созданию задач в канбан-системе.
Пользователь описывает проблему. Твоя задача — задать 2-4 уточняющих вопроса,
чтобы потом создать чёткую задачу с title, description, priority и tags.
Отвечай JSON: {"questions": [{"id": "q1", "text": "..."}]}
"""

GROOM_COMPLETE_SYSTEM = """
Ты — помощник по созданию задач. На основе описания проблемы и ответов пользователя
создай структурированную задачу.
Отвечай JSON: {"title": "...", "description": "...", "priority": "low|medium|high|critical", "tags": ["..."]}
"""


async def call_llm(system: str, user_message: str) -> dict[str, Any]:
    """
    Call an OpenAI-compatible chat completion endpoint and parse JSON content.

    Raises httpx.HTTPError for transport/status failures and ValueError when the
    model response content cannot be parsed as a JSON object.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.llm_api_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_message},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=30.0,
        )
        resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]
    return _parse_json_object(content)


async def start_grooming(problem_description: str) -> dict[str, Any]:
    """Return {"questions": [{"id": str, "text": str}]}."""
    return await call_llm(GROOM_START_SYSTEM, problem_description)


async def complete_grooming(
    problem_description: str,
    answers: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return {"title": str, "description": str, "priority": str, "tags": [str]}."""
    answers_text = "\n".join(
        f"Q: {answer['question_id']} A: {answer['answer']}" for answer in answers
    )
    user_msg = f"Проблема: {problem_description}\n\nОтветы:\n{answers_text}"
    return await call_llm(GROOM_COMPLETE_SYSTEM, user_msg)


SUMMARIZE_SYSTEM = """
Ты — ассистент в канбан-системе. Сделай краткое резюме задачи (2-4 предложения):
ключевая цель, что нужно сделать, важные детали. Отвечай JSON: {"summary": "..."}
"""


async def summarize_task(title: str, description: str) -> str:
    """Return a short AI summary string for a task."""
    user_msg = f"Задача: {title}\n\nОписание: {description or '(нет описания)'}"
    result = await call_llm(SUMMARIZE_SYSTEM, user_msg)
    summary = result.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("LLM returned no summary")
    return summary.strip()


def _parse_json_object(content: Any) -> dict[str, Any]:
    if not isinstance(content, str):
        raise ValueError("LLM response content is not a string")

    try:
        parsed = json.loads(content)
    except JSONDecodeError as direct_error:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise ValueError("LLM response is not valid JSON") from direct_error

        try:
            parsed = json.loads(content[start : end + 1])
        except JSONDecodeError as extracted_error:
            raise ValueError("LLM response is not valid JSON") from extracted_error

    if not isinstance(parsed, dict):
        raise ValueError("LLM response JSON is not an object")
    return parsed
