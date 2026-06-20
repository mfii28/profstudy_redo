from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "StudyMate API"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/studymate"
    
    # Security Settings (for validating NextAuth JWT tokens)
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    
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
