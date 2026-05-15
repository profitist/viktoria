from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.models import User
from app.database import get_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    payload = service.decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await db.get(User, user_uuid)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
