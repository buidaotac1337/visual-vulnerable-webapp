"""Health-check API router for readiness and liveness probes."""

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def get_health(settings: SettingsDep) -> HealthResponse:
    """Return current backend readiness metadata.

    Args:
        settings: Injected application Settings instance.

    Returns:
        HealthResponse containing status, service name, version, and environment.
    """
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
    )
