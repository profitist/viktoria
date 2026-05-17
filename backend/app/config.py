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
    cors_origins: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
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
    llm_api_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("LLM_API_URL", "AI_API_URL"),
    )
    llm_api_key: str = Field(validation_alias=AliasChoices("LLM_API_KEY", "AI_API_KEY"))
    llm_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("LLM_MODEL", "AI_MODEL"),
    )

    s3_endpoint: str = Field(default="http://minio:9000", alias="S3_ENDPOINT")
    s3_public_endpoint: str = Field(default="http://localhost:9000", alias="S3_PUBLIC_ENDPOINT")
    s3_access_key: str = Field(default="minioadmin", alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field(default="minioadmin", alias="S3_SECRET_KEY")
    s3_bucket: str = Field(default="victory-attachments", alias="S3_BUCKET")
    attachment_max_size: int = Field(default=10_485_760, alias="ATTACHMENT_MAX_SIZE")
    attachment_url_ttl: int = Field(default=3600, alias="ATTACHMENT_URL_TTL")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        raw = value.strip()
        if not raw:
            return "http://localhost:3000"
        return raw

    def get_cors_origins(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw.startswith("["):
            return json.loads(raw)
        return [item.strip() for item in raw.split(",") if item.strip()]

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
