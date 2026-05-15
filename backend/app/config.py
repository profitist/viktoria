from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Victory Kanban Backend"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias=AliasChoices("CORS_ORIGINS", "BACKEND_CORS_ORIGINS"),
    )

    database_url: str = Field(alias="DATABASE_URL")
    rabbitmq_url: str | None = Field(default=None, alias="RABBITMQ_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    ai_api_url: str | None = Field(default=None, alias="AI_API_URL")
    ai_api_key: str | None = Field(default=None, alias="AI_API_KEY")
    ai_model: str | None = Field(default=None, alias="AI_MODEL")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            raw_value = value.strip()
            if not raw_value:
                return []
            if raw_value.startswith("["):
                return json.loads(raw_value)
            return [item.strip() for item in raw_value.split(",") if item.strip()]
        return value

    @field_validator("jwt_secret", mode="after")
    @classmethod
    def jwt_secret_must_be_strong(cls, value: str) -> str:
        if value == "changeme":
            raise ValueError("JWT_SECRET must not be 'changeme' in production")
        if len(value) < 32:
            raise ValueError("jwt_secret must be at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()