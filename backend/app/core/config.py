"""Application settings, loaded from environment variables / .env (never hardcoded)."""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "change-me-in-development-only-0123456789abcdef"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | test | production
    app_name: str = "HireHub"
    api_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:5173"

    database_url: str = "postgresql+psycopg://hirehub:hirehub_dev_password@localhost:5433/hirehub"

    secret_key: str = INSECURE_DEFAULT_SECRET
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    reset_token_minutes: int = 30
    verify_token_hours: int = 48

    # Comma separated list of allowed browser origins.
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False  # must be True in production (HTTPS)
    cookie_samesite: str = "lax"  # use "none" only if frontend/API are on different sites

    rate_limit_enabled: bool = True
    serverless: bool = False  # true on Vercel: no connection pooling in-process, transaction-pooler friendly

    storage_backend: str = "local"  # local | s3 (any S3-compatible private bucket: Supabase, R2, AWS)
    upload_dir: Path = Path("./storage")  # used by the local backend; private, never served statically
    s3_bucket: str = ""
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    max_cv_bytes: int = 4 * 1024 * 1024  # 4 MB keeps uploads under Vercel's 4.5 MB request-body limit
    max_image_bytes: int = 2 * 1024 * 1024

    email_backend: str = "console"  # console | smtp
    email_from: str = "HireHub <no-reply@hirehub.local>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    docs_enabled: bool = True

    @field_validator("cors_origins")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _check_production(self) -> "Settings":
        if self.is_production:
            if self.secret_key == INSECURE_DEFAULT_SECRET or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be a random value of 32+ characters in production")
            if self.storage_backend == "s3" and not (self.s3_bucket and self.s3_access_key and self.s3_secret_key):
                raise ValueError("S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY are required when STORAGE_BACKEND=s3")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
