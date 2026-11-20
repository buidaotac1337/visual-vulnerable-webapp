"""FastAPI dependency providers for settings and database lifecycle access."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from app.core import Settings, get_settings
from app.db import DatabaseManager


@dataclass(frozen=True)
class EngineContext:
    """Shared runtime dependencies injected into thin API route handlers.

    Attributes:
        settings: Active application Settings instance.
        db_manager: Managed PostgreSQL pool and reset controller.
    """

    settings: Settings
    db_manager: DatabaseManager


def get_app_settings(request: Request) -> Settings:
    """Resolve active Settings from app.state with fallback to cached defaults.

    Args:
        request: Incoming FastAPI Request.

    Returns:
        Active Settings instance.
    """
    settings = getattr(request.app.state, "settings", None)
    return settings if isinstance(settings, Settings) else get_settings()


def get_db_manager(request: Request) -> DatabaseManager:
    """Resolve the managed DatabaseManager attached to app.state.

    Args:
        request: Incoming FastAPI Request.

    Returns:
        Active DatabaseManager instance.
    """
    manager = getattr(request.app.state, "db_manager", None)
    if isinstance(manager, DatabaseManager):
        return manager
    fallback = DatabaseManager(get_app_settings(request))
    request.app.state.db_manager = fallback
    return fallback


def get_engine_context(request: Request) -> EngineContext:
    """Bundle Settings and DatabaseManager into one injectable EngineContext.

    Args:
        request: Incoming FastAPI Request.

    Returns:
        EngineContext carrying both settings and database manager.
    """
    return EngineContext(
        settings=get_app_settings(request),
        db_manager=get_db_manager(request),
    )


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
DbManagerDep = Annotated[DatabaseManager, Depends(get_db_manager)]
EngineContextDep = Annotated[EngineContext, Depends(get_engine_context)]
