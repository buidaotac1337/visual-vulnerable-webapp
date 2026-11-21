"""FastAPI application factory, lifespan hooks, and exception mapping for VVWA."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health_router, labs_router, system_router
from app.core import (
    ActionNotFoundError,
    DatabaseUnavailableError,
    InvalidActorError,
    InvalidLabIdError,
    LabNotFoundError,
    Settings,
    get_settings,
)
from app.db import DatabaseManager


@asynccontextmanager
async def _lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Manage startup and graceful teardown of database connection pools.

    Args:
        application: Active FastAPI application instance.

    Yields:
        Control while the application serves requests.
    """
    yield
    db_manager = getattr(application.state, "db_manager", None)
    if isinstance(db_manager, DatabaseManager):
        await db_manager.close()


def _register_exception_handlers(application: FastAPI) -> None:
    """Attach domain exception handlers producing consistent JSON error payloads.

    Args:
        application: FastAPI application receiving error handlers.
    """

    @application.exception_handler(InvalidLabIdError)
    async def _handle_invalid_id(_request: Request, exc: InvalidLabIdError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @application.exception_handler(InvalidActorError)
    async def _handle_invalid_actor(_request: Request, exc: InvalidActorError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @application.exception_handler(LabNotFoundError)
    async def _handle_lab_not_found(_request: Request, exc: LabNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @application.exception_handler(ActionNotFoundError)
    async def _handle_action_not_found(
        _request: Request,
        exc: ActionNotFoundError,
    ) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @application.exception_handler(DatabaseUnavailableError)
    async def _handle_db_unavailable(
        _request: Request,
        exc: DatabaseUnavailableError,
    ) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})


def create_app(
    settings: Settings | None = None,
    db_manager: DatabaseManager | None = None,
) -> FastAPI:
    """Construct and configure the VVWA FastAPI application instance.

    Args:
        settings: Optional settings override (useful for isolated unit tests).
        db_manager: Optional DatabaseManager override for isolated unit tests.

    Returns:
        Configured FastAPI application ready to serve requests.
    """
    resolved_settings = settings or get_settings()
    resolved_db_manager = db_manager or DatabaseManager(resolved_settings)

    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
        lifespan=_lifespan,
    )
    application.state.settings = resolved_settings
    application.state.db_manager = resolved_db_manager

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    _register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(system_router)
    application.include_router(labs_router)
    return application


app = create_app()
