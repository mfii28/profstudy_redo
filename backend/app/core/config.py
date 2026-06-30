from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "StudyMate API"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings (SQLAlchemy async)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/studymate"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Synchronous variant for Alembic / scripts that don't need async
    SYNC_DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/studymate"
    
    # Security Settings (for verifying Supabase JWT tokens)
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    
    # Supabase Service Role (for admin-auth operations)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # Cloudflare R2 Settings
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None
    R2_PUBLIC_DOMAIN: Optional[str] = None

    # Paystack Settings
    PAYSTACK_SECRET_KEY: Optional[str] = None

    # Gemini AI Settings
    GEMINI_API_KEY: Optional[str] = None

    # Resend Email Settings
    RESEND_API_KEY: Optional[str] = None

    # Zoom Settings
    ZOOM_SDK_KEY: Optional[str] = None
    ZOOM_SDK_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
