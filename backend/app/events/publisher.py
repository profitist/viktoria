import os

import aio_pika
from aio_pika.abc import AbstractChannel
from fastapi import FastAPI

from app.events.types import EventEnvelope

RABBITMQ_URL_ENV = "RABBITMQ_URL"
DEFAULT_RABBITMQ_URL = "amqp://guest:guest@rabbitmq:5672/"
EVENTS_EXCHANGE = "kanban_events"


async def get_channel(app: FastAPI) -> AbstractChannel:
    channel = getattr(app.state, "rabbitmq_channel", None)
    if channel is not None and not channel.is_closed:
        return channel

    connection = getattr(app.state, "rabbitmq_connection", None)
    if connection is None or connection.is_closed:
        rabbitmq_url = os.getenv(RABBITMQ_URL_ENV, DEFAULT_RABBITMQ_URL)
        connection = await aio_pika.connect_robust(rabbitmq_url)
        app.state.rabbitmq_connection = connection

    channel = await connection.channel()
    await channel.declare_exchange(
        EVENTS_EXCHANGE,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )
    app.state.rabbitmq_channel = channel
    return channel


async def publish(event: EventEnvelope, channel: AbstractChannel) -> None:
    exchange = await channel.declare_exchange(
        EVENTS_EXCHANGE,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )
    message = aio_pika.Message(
        body=event.model_dump_json().encode("utf-8"),
        content_type="application/json",
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
    )
    await exchange.publish(message, routing_key=event.event_type)
