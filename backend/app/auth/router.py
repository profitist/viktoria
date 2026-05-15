from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.deps import get_current_user, oauth2_scheme
from app.auth.models import User
from app.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.database import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


class AccessTokenResponse(BaseModel):
    access_token: str


@router.post("/register", response_model=TokenResponse)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_session),
) -> TokenResponse:
    user = await service.register(db, data)
    access = service.create_access_token(str(user.id))
    refresh = service.create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_session),
) -> TokenResponse:
    user, access, refresh = await service.login(db, data)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(data: RefreshRequest) -> AccessTokenResponse:
    access = service.refresh_access_token(data.refresh_token)
    return AccessTokenResponse(access_token=access)


@router.post("/logout")
async def logout(
    data: RefreshRequest,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
) -> dict:
    service.logout(access_token=token, refresh_token=data.refresh_token)
    return {}
