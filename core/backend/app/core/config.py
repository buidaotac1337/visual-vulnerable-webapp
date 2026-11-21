"""Application configuration loaded from environment variables."""

import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[4]


def _default_upload_sandbox_dir() -> Path:
    """Return the default isolated temp directory for Lab 07 uploaded files."""
    return Path(tempfile.gettempdir()) / "vvwa-uploads"


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
        upload_sandbox_dir: Isolated temp directory outside repo/labs for upload labs.
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
    upload_sandbox_dir: Path = Field(default_factory=_default_upload_sandbox_dir)
    db_pool_min_size: int = Field(default=1, ge=1)
    db_pool_max_size: int = Field(default=10, ge=1)
    db_connect_timeout: float = Field(default=5.0, gt=0.0)

    @field_validator("upload_sandbox_dir", mode="before")
    @classmethod
    def _default_blank_upload_sandbox_dir(cls, value: object) -> object:
        """Prevent empty env vars from falling back to the current working directory.

        Args:
            value: Raw environment or constructor value for upload_sandbox_dir.

        Returns:
            Provided non-empty value, or the default temp sandbox path.
        """
        if value is None:
            return _default_upload_sandbox_dir()
        if isinstance(value, str) and not value.strip():
            return _default_upload_sandbox_dir()
        if isinstance(value, Path) and not str(value).strip():
            return _default_upload_sandbox_dir()
        return value

    @model_validator(mode="after")
    def _validate_pool_bounds(self) -> "Settings":
        """Ensure pool bounds are ordered and upload_sandbox_dir is isolated from mounts.

        Returns:
            Validated Settings instance.

        Raises:
            ValueError: If pool bounds are inverted or upload_sandbox_dir overlaps mounts.
        """
        if self.db_pool_min_size > self.db_pool_max_size:
            msg = "db_pool_min_size must be less than or equal to db_pool_max_size."
            raise ValueError(msg)
        sandbox = self.upload_sandbox_dir.resolve()
        labs = self.labs_dir.resolve()
        repo = _DEFAULT_REPO_ROOT.resolve()
        if sandbox.is_relative_to(labs) or labs.is_relative_to(sandbox):
            msg = "upload_sandbox_dir must not overlap labs_dir."
            raise ValueError(msg)
        if sandbox.is_relative_to(repo) or repo.is_relative_to(sandbox):
            msg = "upload_sandbox_dir must not overlap the repository root."
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
