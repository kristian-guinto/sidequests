"""Application Settings for pollmph

Inspired by the OpenElectricity / opennem settings architecture.
Manages environment variables, defaults, and runtime configuration.
"""

from typing import List
import os
from dotenv import load_dotenv

# Pre-load .env if available
load_dotenv()

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field, field_validator

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
            case_sensitive=False,
        )

        # Environment
        environment: str = Field(default="DEV", alias="ENVIRONMENT")
        debug: bool = Field(default=False, alias="DEBUG")

        @field_validator("debug", mode="before")
        @classmethod
        def parse_debug(cls, v):
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                return v.lower() in ("true", "1", "yes", "on", "t", "dev", "debug")
            return False

        # API Configuration
        api_prefix: str = "/api/v1"
        title: str = "pollmph API"
        version: str = "0.2.0"
        description: str = (
            "Philippine Political Sentiment Analysis & Virtual Polling Oracle API. "
            "Exposes propositions, sentiment telemetry, weekly narrative summaries, "
            "and virtual demographic polling instrumentation."
        )
        host: str = "0.0.0.0"
        port: int = 8000

        # CORS
        cors_origins: List[str] = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "https://pollmph.vercel.app",
            "*",
        ]

        # Supabase
        supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
        supabase_key: str | None = Field(default=None, alias="SUPABASE_KEY")
        supabase_url_prod: str | None = Field(default=None, alias="SUPABASE_URL_PROD")
        supabase_service_key_prod: str | None = Field(
            default=None, alias="SUPABASE_SERVICE_KEY_PROD"
        )

        # LLM Keys
        gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
        xai_api_key: str | None = Field(default=None, alias="XAI_API_KEY")

        # LLM Models
        gemini_model: str = Field(
            default="gemini-flash-lite-latest", alias="GEMINI_MODEL"
        )
        xai_model: str = Field(default="grok-4-1-fast-reasoning", alias="XAI_MODEL")
        ollama_model: str = Field(default="gemma3n", alias="OLLAMA_MODEL")

        # Scheduling & Processing
        max_daily_propositions: int = Field(default=5, alias="MAX_DAILY_PROPOSITIONS")

        @property
        def is_prod(self) -> bool:
            return self.environment.upper() == "PROD"

        @property
        def is_dev(self) -> bool:
            return not self.is_prod

        @property
        def active_supabase_url(self) -> str | None:
            return self.supabase_url_prod if self.is_prod else self.supabase_url

        @property
        def active_supabase_key(self) -> str | None:
            return self.supabase_service_key_prod if self.is_prod else self.supabase_key

except ImportError:
    # Fallback if pydantic-settings is not installed
    class Settings:  # type: ignore
        def __init__(self):
            self.environment = os.getenv("ENVIRONMENT", "DEV")
            self.debug = os.getenv("DEBUG", "false").lower() == "true"
            self.api_prefix = "/api/v1"
            self.title = "pollmph API"
            self.version = "0.2.0"
            self.description = (
                "Philippine Political Sentiment Analysis & Virtual Polling Oracle API"
            )
            self.host = os.getenv("HOST", "0.0.0.0")
            self.port = int(os.getenv("PORT", "8000"))
            self.cors_origins = [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "https://pollmph.vercel.app",
                "*",
            ]
            self.supabase_url = os.getenv("SUPABASE_URL")
            self.supabase_key = os.getenv("SUPABASE_KEY")
            self.supabase_url_prod = os.getenv("SUPABASE_URL_PROD")
            self.supabase_service_key_prod = os.getenv("SUPABASE_SERVICE_KEY_PROD")
            self.gemini_api_key = os.getenv("GEMINI_API_KEY")
            self.xai_api_key = os.getenv("XAI_API_KEY")
            self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
            self.xai_model = os.getenv("XAI_MODEL", "grok-4-1-fast-reasoning")
            self.ollama_model = os.getenv("OLLAMA_MODEL", "gemma3n")
            self.max_daily_propositions = int(os.getenv("MAX_DAILY_PROPOSITIONS", "5"))

        @property
        def is_prod(self) -> bool:
            return self.environment.upper() == "PROD"

        @property
        def is_dev(self) -> bool:
            return not self.is_prod

        @property
        def active_supabase_url(self) -> str | None:
            return self.supabase_url_prod if self.is_prod else self.supabase_url

        @property
        def active_supabase_key(self) -> str | None:
            return self.supabase_service_key_prod if self.is_prod else self.supabase_key


settings = Settings()
