from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.attachments.models import Attachment
from app.attachments.schemas import AttachmentResponse, AttachmentUploader
from app.attachments.storage import StorageService
from app.auth.models import User
from app.config import settings
from app.tasks.models import Task
from app.workspace.models import WorkspaceMember, WorkspaceRole

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
}


def _is_allowed_content_type(content_type: str) -> bool:
    if content_type.startswith("image/"):
        return True
    return content_type in ALLOWED_CONTENT_TYPES


def _build_response(attachment: Attachment, url: str) -> AttachmentResponse:
    uploader = None
    if attachment.uploader is not None:
        uploader = AttachmentUploader.model_validate(attachment.uploader)
    return AttachmentResponse(
        id=attachment.id,
        task_id=attachment.task_id,
        filename=attachment.filename,
        content_type=attachment.content_type,
        size=attachment.size,
        url=url,
        uploaded_by=uploader,
        created_at=attachment.created_at,
    )


async def list_attachments(
    session: AsyncSession,
    task_id: UUID,
    storage: StorageService,
) -> list[AttachmentResponse]:
    result = await session.execute(
        select(Attachment)
        .where(Attachment.task_id == task_id)
        .options(selectinload(Attachment.uploader))
        .order_by(Attachment.created_at.asc())
    )
    attachments = list(result.scalars().all())
    responses = []
    for a in attachments:
        url = await storage.signed_url(a.storage_key, settings.attachment_url_ttl)
        responses.append(_build_response(a, url))
    return responses


async def upload_attachment(
    session: AsyncSession,
    task_id: UUID,
    uploader: User,
    filename: str,
    content_type: str,
    data: bytes,
    storage: StorageService,
) -> AttachmentResponse:
    if len(data) > settings.attachment_max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="file too large",
        )
    if not _is_allowed_content_type(content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="unsupported file type",
        )

    storage_key = f"{task_id}/{uuid4()}_{filename}"
    await storage.put(storage_key, data, content_type)

    attachment = Attachment(
        task_id=task_id,
        filename=filename,
        content_type=content_type,
        size=len(data),
        storage_key=storage_key,
        uploaded_by=uploader.id,
    )
    session.add(attachment)
    await session.flush()
    await session.commit()

    result = await session.execute(
        select(Attachment)
        .where(Attachment.id == attachment.id)
        .options(selectinload(Attachment.uploader))
    )
    attachment = result.scalar_one()
    url = await storage.signed_url(storage_key, settings.attachment_url_ttl)
    return _build_response(attachment, url)


async def delete_attachment(
    session: AsyncSession,
    attachment_id: UUID,
    actor: User,
    storage: StorageService,
) -> None:
    result = await session.execute(
        select(Attachment).where(Attachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment not found")

    if attachment.uploaded_by != actor.id:
        task = await session.get(Task, attachment.task_id)
        role_result = await session.execute(
            select(WorkspaceMember.role).where(
                WorkspaceMember.workspace_id == task.workspace_id,
                WorkspaceMember.user_id == actor.id,
            )
        )
        role = role_result.scalar_one_or_none()
        if role not in (WorkspaceRole.ADMIN, WorkspaceRole.OWNER):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")

    await storage.delete(attachment.storage_key)
    await session.delete(attachment)
    await session.commit()
