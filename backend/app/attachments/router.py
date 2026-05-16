from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.attachments.service import delete_attachment, list_attachments, upload_attachment
from app.attachments.storage import StorageService, storage as _storage
from app.auth.deps import get_current_user
from app.auth.models import User
from app.attachments.schemas import AttachmentResponse
from app.database import get_session

router = APIRouter(tags=["attachments"])


def _get_storage() -> StorageService:
    return _storage


@router.get(
    "/tasks/{task_id}/attachments",
    response_model=list[AttachmentResponse],
    status_code=status.HTTP_200_OK,
)
async def get_attachments(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    stor: Annotated[StorageService, Depends(_get_storage)],
) -> list[AttachmentResponse]:
    return await list_attachments(session=session, task_id=task_id, storage=stor)


@router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_attachment(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    stor: Annotated[StorageService, Depends(_get_storage)],
    file: UploadFile = File(...),
) -> AttachmentResponse:
    data = await file.read()
    return await upload_attachment(
        session=session,
        task_id=task_id,
        uploader=current_user,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        storage=stor,
    )


@router.delete(
    "/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_attachment(
    attachment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    stor: Annotated[StorageService, Depends(_get_storage)],
) -> Response:
    await delete_attachment(
        session=session,
        attachment_id=attachment_id,
        actor=current_user,
        storage=stor,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
