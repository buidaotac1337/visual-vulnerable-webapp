"""Public barrel exports for backend API routers."""

from app.api.health import router as health_router
from app.api.labs import router as labs_router
from app.api.system import router as system_router

__all__ = ["health_router", "labs_router", "system_router"]
