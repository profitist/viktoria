from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, body: str) -> None:
    """
    Email delivery hook.

    The concrete SMTP/provider integration can replace this function without
    changing subscription business logic.
    """
    logger.info("email queued: to=%s subject=%s body=%s", to_email, subject, body)
