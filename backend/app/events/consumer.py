import asyncio
import inspect
import json
import logging
from json import JSONDecodeError
from typing import Any, get_args
from uuid import UUID

import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from fastapi import FastAPI
from pydantic import ValidationError
from sqlalchemy import select

from app.events.publisher import EVENTS_EXCHANGE, get_channel
from app.events.types import EventEnvelope, EventType

logger = logging.getLogger(__name__)

TASK_EVENTS_QUEUE = "task_events"

_consumer_app: FastAPI | None = None
_processed_event_ids: set[UUID] = set()
_processed_lock = asyncio.Lock()


async def start_consumer(app: FastAPI) -> None:
    global _consumer_app

    _consumer_app = app
    channel = await get_channel(app)
    exchange = await channel.declare_exchange(
        EVENTS_EXCHANGE,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )
    queue = await channel.declare_queue(TASK_EVENTS_QUEUE, durable=True)

    for routing_key in get_args(EventType):
        await queue.bind(exchange, routing_key=routing_key)

    consumer_tag = await queue.consume(process_message)
    app.state.rabbitmq_consumer_tag = consumer_tag
    logger.info("RabbitMQ consumer started")


async def process_message(message: AbstractIncomingMessage) -> None:
    try:
        raw_event = json.loads(message.body)
        event = EventEnvelope.model_validate(raw_event)
    except (JSONDecodeError, UnicodeDecodeError, ValidationError, TypeError):
        await message.nack(requeue=False)
        return

    if await _is_duplicate(event.event_id):
        logger.info("duplicate event skipped: %s", event.event_id)
        await message.ack()
        return

    try:
        enriched_event = await enrich_event(event)
        await fanout_event(enriched_event)
    except Exception:
        await _forget_processed(event.event_id)
        await message.nack(requeue=True)
        logger.exception("Failed to process event %s, requeueing", event.event_id)

    await message.ack()


async def enrich_event(event: EventEnvelope) -> dict[str, Any]:
    from app.auth.models import User
    from app.database import AsyncSessionLocal
    from app.tasks.models import Task
    from app.workspace.models import Workspace

    async with AsyncSessionLocal() as session:
        actor_name = await session.scalar(
            select(User.name).where(User.id == event.actor_id)
        )
        workspace_name = await session.scalar(
            select(Workspace.name).where(Workspace.id == event.workspace_id)
        )
        task_title = await session.scalar(
            select(Task.title).where(Task.id == event.task_id)
        )

    return {
        **event.model_dump(mode="json"),
        "actor_name": actor_name,
        "workspace_name": workspace_name,
        "task_title": task_title,
    }


async def fanout_event(enriched_event: dict[str, Any]) -> None:
    if _consumer_app is None:
        return

    automation_engine = getattr(_consumer_app.state, "automation_engine", None)
    notification_hub = getattr(_consumer_app.state, "notification_hub", None)
    audit_recorder = getattr(_consumer_app.state, "audit_recorder", None)

    fanout_calls = []

    if automation_engine is not None:
        fanout_calls.append(_maybe_await(automation_engine.process(enriched_event)))

    if notification_hub is not None:
        fanout_calls.append(
            _maybe_await(
                notification_hub.broadcast(
                    enriched_event["workspace_id"],
                    enriched_event,
                )
            )
        )

    if audit_recorder is not None:
        fanout_calls.append(_maybe_await(audit_recorder.record(enriched_event)))

    if fanout_calls:
        await asyncio.gather(*fanout_calls)


async def _is_duplicate(event_id: UUID) -> bool:
    async with _processed_lock:
        if event_id in _processed_event_ids:
            return True
        _processed_event_ids.add(event_id)
        return False


async def _forget_processed(event_id: UUID) -> None:
    async with _processed_lock:
        _processed_event_ids.discard(event_id)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value
