"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    """Runtime settings for the VVWA FastAPI engine.

    Attributes:
        app_name: Human-readable service name returned by health endpoints.
        app_version: Semantic version string of the backend engine.
        environment: Deployment environment identifier (local, test, ci).
        cors_origins: Comma-separated list of allowed frontend origins.
        database_url: PostgreSQL DSN for the restricted lab_app_user role.
        admin_database_url: PostgreSQL DSN for the lab_admin_user reset role.
        labs_dir: Filesystem directory containing isolated security lab folders.
        seed_sql_path: Filesystem path to the idempotent MiniShop seed SQL script.
        db_pool_min_size: Minimum connections maintained in the app asyncpg pool.
        db_pool_max_size: Maximum connections allowed in the app asyncpg pool.
        db_connect_timeout: PostgreSQL connection timeout in seconds.
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
    labs_dir: Path = Field(default_factory=lambda: _DEFAULT_REPO_ROOT / "labs")
    seed_sql_path: Path = Field(
        default_factory=lambda: _DEFAULT_REPO_ROOT / "core" / "postgres" / "seed.sql",
    )
    db_pool_min_size: int = Field(default=1, ge=1)
    db_pool_max_size: int = Field(default=10, ge=1)
    db_connect_timeout: float = Field(default=5.0, gt=0.0)

    @model_validator(mode="after")
    def _validate_pool_bounds(self) -> "Settings":
        """Ensure db_pool_min_size never exceeds db_pool_max_size.

        Returns:
            Validated Settings instance.

        Raises:
            ValueError: If db_pool_min_size > db_pool_max_size.
        """
        if self.db_pool_min_size > self.db_pool_max_size:
            msg = "db_pool_min_size must be less than or equal to db_pool_max_size."
            raise ValueError(msg)
        return self

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
