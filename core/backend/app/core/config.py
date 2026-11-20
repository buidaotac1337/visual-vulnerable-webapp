"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the VVWA FastAPI engine.

    Attributes:
        app_name: Human-readable service name returned by health endpoints.
        app_version: Semantic version string of the backend engine.
        environment: Deployment environment identifier (local, test, ci).
        cors_origins: Comma-separated list of allowed frontend origins.
        database_url: PostgreSQL DSN for the restricted lab_app_user role.
        admin_database_url: PostgreSQL DSN for the lab_admin_user reset role.
    """

    model_config = SettingsConfigDict(
        env_prefix="VVWA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Visual Vulnerable Web App API")
    app_version: str = Field(default="0.1.0")
    environment: str = Field(default="local")
    cors_origins: str = Field(default="http://localhost:5173")
    database_url: str = Field(
        default="postgresql://lab_app_user:lab_app_pass@postgres:5432/minishop",
    )
    admin_database_url: str = Field(
        default="postgresql://lab_admin_user:lab_admin_pass@postgres:5432/minishop",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a clean list of strings.

        Returns:
            List of non-empty origin URLs stripped of surrounding whitespace.
        """
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings.

    Returns:
        Cached Settings instance parsed from environment variables.
    """
    return Settings()
