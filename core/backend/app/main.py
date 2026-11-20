"""FastAPI application factory and ASGI entrypoint for VVWA."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health_router
from app.core import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construct and configure the VVWA FastAPI application instance.

    Args:
        settings: Optional settings override (useful for isolated unit tests).

    Returns:
        Configured FastAPI application ready to serve requests.
    """
    resolved_settings = settings or get_settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    application.state.settings = resolved_settings
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    return application


app = create_app()
