from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.smtp_configured:
        logger.warning(
            "SMTP не настроен (SMTP_HOST/SMTP_USER/SMTP_FROM пусты) — "
            "email-уведомление для %s пропущено",
            to,
        )
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content("This notification requires an HTML-capable email client.")
    message.add_alternative(html, subtype="html")

    smtp = aiosmtplib.SMTP(
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        start_tls=True,
    )
    try:
        await smtp.connect()
        await smtp.login(settings.smtp_user, settings.smtp_password)
        await smtp.send_message(message)
    finally:
        if smtp.is_connected:
            await smtp.quit()
