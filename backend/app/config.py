from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("jwt_secret", mode="after")
    @classmethod
    def jwt_secret_must_be_strong(cls, value: str) -> str:
        if value == "changeme":
            raise ValueError("JWT_SECRET must not be 'changeme' in production")
        if len(value) < 32:
            raise ValueError("jwt_secret must be at least 32 characters")
        return value


settings = Settings()
