from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib

from app.config import settings


async def send_email(to: str, subject: str, html: str) -> None:
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
