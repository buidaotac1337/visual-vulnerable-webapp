"""Health-check API router for readiness and liveness probes."""

from fastapi import APIRouter, Request

from app.core import Settings, get_settings
from app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Return current backend readiness metadata.

    Args:
        request: Incoming FastAPI request providing access to app.state.settings.

    Returns:
        HealthResponse containing status, service name, version, and environment.
    """
    settings = getattr(request.app.state, "settings", None)
    resolved: Settings = settings if isinstance(settings, Settings) else get_settings()
    return HealthResponse(
        status="ok",
        service=resolved.app_name,
        version=resolved.app_version,
        environment=resolved.environment,
    )
