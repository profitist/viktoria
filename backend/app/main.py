from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from importlib import import_module

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 — registers all ORM mappers before any query runs
from app.analytics.router import router as analytics_router
from app.analytics.snapshot import snapshot_loop
from app.audit.recorder import AuditRecorder
from app.attachments.storage import storage as _storage
from app.config import get_settings
from app.database import engine
from app.events.consumer import start_consumer
from app.notifications.hub import manager as _notification_hub
from app.notifications.router import ws_router as _notifications_ws_router

MODULE_NAMES = (
    "auth",
    "workspace",
    "board",
    "tasks",
    "automation",
    "notifications",
    "audit",
    "project",
    "tags",
    "comments",
    "attachments",
)


def _load_router(module_name: str) -> APIRouter:
    try:
        module = import_module(f"app.{module_name}.router")
    except ModuleNotFoundError as exc:
        if exc.name != f"app.{module_name}.router":
            raise
        return APIRouter(prefix=f"/{module_name}", tags=[module_name])

    router = getattr(module, "router", None)
    if not isinstance(router, APIRouter):
        raise RuntimeError(f"app.{module_name}.router must expose `router = APIRouter(...)`.")
    return router


async def _start_rabbitmq_consumer(app: FastAPI) -> None:
    await start_consumer(app)


async def _stop_rabbitmq_consumer(app: FastAPI) -> None:
    consumer_tag = getattr(app.state, "rabbitmq_consumer_tag", None)
    if consumer_tag is None:
        return
    cancel_method = getattr(consumer_tag, "cancel", None)
    if callable(cancel_method):
        result = cancel_method()
        if hasattr(result, "__await__"):
            await result


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.notification_hub = _notification_hub
    app.state.audit_recorder = AuditRecorder()
    await _storage.ensure_bucket()
    await _start_rabbitmq_consumer(app)
    app.state.analytics_snapshot_task = asyncio.create_task(snapshot_loop())
    try:
        yield
    finally:
        snapshot_task = getattr(app.state, "analytics_snapshot_task", None)
        if snapshot_task is not None:
            snapshot_task.cancel()
            with suppress(asyncio.CancelledError):
                await snapshot_task
        await _stop_rabbitmq_consumer(app)
        await engine.dispose()


def create_application() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api_router = APIRouter(prefix=settings.api_v1_prefix)

    @api_router.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    for module_name in MODULE_NAMES:
        api_router.include_router(_load_router(module_name))

    application.include_router(api_router)
    application.include_router(analytics_router)
    application.include_router(_notifications_ws_router)
    return application


app = create_application()
