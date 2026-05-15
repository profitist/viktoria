from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import LoginRequest, RegisterRequest
from app.config import settings

_refresh_blocklist: set[str] = set()

_DUMMY_HASH: bytes = bcrypt.hashpw(b"dummy-timing-protection", bcrypt.gensalt())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    exp = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "exp": exp, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    exp = datetime.now(tz=timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": user_id, "exp": exp, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def register(db: AsyncSession, data: RegisterRequest) -> User:
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="email already registered")
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        name=data.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login(db: AsyncSession, data: LoginRequest) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is None:
        bcrypt.checkpw(b"dummy", _DUMMY_HASH)
        raise HTTPException(
            status_code=401,
            detail="invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    return user, access, refresh


def refresh_access_token(token: str) -> str:
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if token in _refresh_blocklist:
        raise HTTPException(
            status_code=401,
            detail="token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return create_access_token(payload["sub"])


def logout(access_token: str, refresh_token: str) -> None:
    try:
        decode_token(refresh_token)
    except HTTPException:
        return
    _refresh_blocklist.add(refresh_token)
