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
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.events.publisher import EVENTS_EXCHANGE, get_channel
from app.events.types import EventEnvelope, EventType
from app.notifications.jsonrpc import (
    EVENT_LOG_ENTRY,
    TASK_CREATED,
    TASK_DELETED,
    TASK_MOVED,
    TASK_UPDATED,
    build,
)

logger = logging.getLogger(__name__)

TASK_EVENTS_QUEUE = "task_events"

_EVENT_TYPE_TO_METHOD: dict[str, str] = {
    "task.created": TASK_CREATED,
    "task.updated": TASK_UPDATED,
    "task.moved": TASK_MOVED,
    "task.deleted": TASK_DELETED,
}

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
        return

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

    processed = await _persist_event_side_effects(enriched_event)
    if not processed:
        return

    automation_engine = getattr(_consumer_app.state, "automation_engine", None)
    notification_hub = getattr(_consumer_app.state, "notification_hub", None)
    audit_recorder = getattr(_consumer_app.state, "audit_recorder", None)

    fanout_calls = []

    if automation_engine is not None:
        fanout_calls.append(_maybe_await(automation_engine.process(enriched_event)))

    if notification_hub is not None:
        event_type = enriched_event.get("event_type", "")
        method = _EVENT_TYPE_TO_METHOD.get(event_type, EVENT_LOG_ENTRY)
        ws_message = build(method, enriched_event)
        log_message = build(EVENT_LOG_ENTRY, enriched_event)
        workspace_id = enriched_event["workspace_id"]
        fanout_calls.append(_maybe_await(notification_hub.broadcast(workspace_id, ws_message)))
        if method != EVENT_LOG_ENTRY:
            fanout_calls.append(_maybe_await(notification_hub.broadcast(workspace_id, log_message)))

    if audit_recorder is not None:
        fanout_calls.append(_maybe_await(audit_recorder.record(enriched_event)))

    if fanout_calls:
        await asyncio.gather(*fanout_calls)


async def _persist_event_side_effects(enriched_event: dict[str, Any]) -> bool:
    from app.database import AsyncSessionLocal
    from app.events.models import ProcessedEvent
    from app.notifications.service import create_notifications_for_workspace

    event_id = _as_uuid(enriched_event["event_id"])
    workspace_id = _as_uuid(enriched_event["workspace_id"])
    event_type = str(enriched_event["event_type"])

    async with AsyncSessionLocal() as session:
        existing_event = await session.scalar(
            select(ProcessedEvent.event_id).where(ProcessedEvent.event_id == event_id)
        )
        if existing_event is not None:
            logger.info("durable duplicate event skipped: %s", event_id)
            return False

        event_data = _notification_data(enriched_event)
        await create_notifications_for_workspace(
            session=session,
            workspace_id=workspace_id,
            message=_default_notification_message(enriched_event),
            event_type=event_type,
            data=event_data,
        )
        await _process_automation_rules(session, enriched_event)

        session.add(
            ProcessedEvent(
                event_id=event_id,
                workspace_id=workspace_id,
                event_type=event_type,
            )
        )
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            logger.info("durable duplicate event skipped after insert race: %s", event_id)
            return False

    return True


async def _process_automation_rules(
    session: AsyncSession,
    enriched_event: dict[str, Any],
) -> None:
    from app.automation.models import AutomationRule
    from app.workspace.models import WorkspaceSettings

    workspace_id = _as_uuid(enriched_event["workspace_id"])
    event_type = str(enriched_event["event_type"])
    automation_enabled = await session.scalar(
        select(WorkspaceSettings.automation_enabled).where(
            WorkspaceSettings.workspace_id == workspace_id
        )
    )
    if automation_enabled is False:
        return

    result = await session.execute(
        select(AutomationRule)
        .where(
            AutomationRule.workspace_id == workspace_id,
            AutomationRule.active.is_(True),
            AutomationRule.trigger == event_type,
        )
        .order_by(AutomationRule.name.asc(), AutomationRule.id.asc())
    )
    rules = result.scalars().all()

    for rule in rules:
        if not _condition_matches(rule.condition, enriched_event):
            continue
        await _execute_rule_action(session, rule, enriched_event)


async def _execute_rule_action(
    session: AsyncSession,
    rule: Any,
    enriched_event: dict[str, Any],
) -> None:
    action = rule.action or {}
    action_type = action.get("type")
    params = action.get("params") or {}

    if action_type in {"notify_members", "notify_all"}:
        from app.notifications.service import create_notifications_for_workspace

        workspace_id = _as_uuid(enriched_event["workspace_id"])
        message = params.get("message")
        if not isinstance(message, str) or not message.strip():
            message = f"Automation rule fired: {rule.name}"
        await create_notifications_for_workspace(
            session=session,
            workspace_id=workspace_id,
            message=message,
            event_type="rule_fired",
            data={
                **_notification_data(enriched_event),
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "action_type": action_type,
            },
        )
        return

    if action_type == "add_tag":
        await _add_task_tag(session, enriched_event, params)
        return

    logger.info("automation action skipped: unsupported action type %r", action_type)


async def _add_task_tag(
    session: AsyncSession,
    enriched_event: dict[str, Any],
    params: dict[str, Any],
) -> None:
    from app.tasks.models import Task

    tag = params.get("tag")
    if not isinstance(tag, str) or not tag.strip():
        logger.warning("automation add_tag skipped: missing tag")
        return

    task = await session.scalar(
        select(Task).where(
            Task.id == _as_uuid(enriched_event["task_id"]),
            Task.workspace_id == _as_uuid(enriched_event["workspace_id"]),
        )
    )
    if task is None:
        logger.warning("automation add_tag skipped: task not found")
        return

    tags = list(task.tags or [])
    if tag not in tags:
        task.tags = [*tags, tag]


def _condition_matches(
    condition: dict[str, Any] | None,
    enriched_event: dict[str, Any],
) -> bool:
    if condition is None:
        return True

    field = condition.get("field")
    operator = condition.get("operator")
    expected = condition.get("value")
    if not isinstance(field, str) or not isinstance(operator, str):
        return False

    context = _event_context(enriched_event)
    actual = context.get(field)
    if operator == "eq":
        return actual == expected
    if operator == "contains":
        if isinstance(actual, str):
            return str(expected) in actual
        if isinstance(actual, (list, tuple, set)):
            return expected in actual
        return False
    if operator == "gt":
        try:
            return actual > expected
        except TypeError:
            return False
    if operator == "lt":
        try:
            return actual < expected
        except TypeError:
            return False
    return False


def _event_context(enriched_event: dict[str, Any]) -> dict[str, Any]:
    payload = enriched_event.get("payload")
    if isinstance(payload, dict):
        return {**enriched_event, **payload}
    return dict(enriched_event)


def _default_notification_message(enriched_event: dict[str, Any]) -> str:
    event_type = str(enriched_event.get("event_type", "event"))
    task_title = enriched_event.get("task_title") or enriched_event.get("task_id")
    actor_name = enriched_event.get("actor_name") or "Someone"

    event_labels = {
        "task.created": "created",
        "task.updated": "updated",
        "task.moved": "moved",
        "task.deleted": "deleted",
    }
    action = event_labels.get(event_type, "changed")
    return f"{actor_name} {action} task {task_title}"


def _notification_data(enriched_event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": str(enriched_event["event_id"]),
        "event_type": enriched_event["event_type"],
        "workspace_id": str(enriched_event["workspace_id"]),
        "task_id": str(enriched_event["task_id"]),
        "actor_id": str(enriched_event["actor_id"]),
        "payload": enriched_event.get("payload", {}),
    }


def _as_uuid(value: Any) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


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
