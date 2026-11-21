"""FastAPI dependency providers for settings and database lifecycle access."""

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Body, Depends, Header, Request

from app.core import Settings, get_settings
from app.db import DatabaseManager
from app.services import ACTOR_HEADER, normalize_actor_username


@dataclass(frozen=True)
class EngineContext:
    """Shared runtime dependencies injected into thin API route handlers.

    Attributes:
        settings: Active application Settings instance.
        db_manager: Managed PostgreSQL pool and reset controller.
    """

    settings: Settings
    db_manager: DatabaseManager


@dataclass(frozen=True)
class LabInvocation:
    """Both input channels of a lab action request, kept explicitly separate (ADR-0005).

    Attributes:
        payload: JSON body from the sandbox form (untrusted, attacker-controlled).
        actor: Validated persona from the X-VVWA-Actor session header (trusted), if any.
    """

    payload: dict[str, Any]
    actor: str | None


def get_lab_invocation(
    payload: dict[str, Any] = Body(default_factory=dict),  # noqa: B008
    actor: Annotated[str | None, Header(alias=ACTOR_HEADER)] = None,
) -> LabInvocation:
    """Parse the request body and validate the session header before any DB access.

    Args:
        payload: JSON request body sent by the MiniShop Sandbox UI.
        actor: Raw X-VVWA-Actor header value, if present.

    Returns:
        LabInvocation with the payload and normalized actor username.
    """
    return LabInvocation(payload=payload, actor=normalize_actor_username(actor))


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
LabInvocationDep = Annotated[LabInvocation, Depends(get_lab_invocation)]
