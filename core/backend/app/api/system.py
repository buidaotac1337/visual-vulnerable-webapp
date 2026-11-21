"""System maintenance API router (1-click MiniShop database reset)."""

from fastapi import APIRouter

from app.api.deps import EngineContextDep
from app.schemas import ResetDatabaseResponse
from app.services import reset_upload_sandbox

router = APIRouter(prefix="/api/system", tags=["system"])


@router.post("/reset-db", response_model=ResetDatabaseResponse)
async def reset_database_endpoint(ctx: EngineContextDep) -> ResetDatabaseResponse:
    """Restore all MiniShop tables and clean the isolated upload sandbox.

    Args:
        ctx: Injected EngineContext providing Settings and DatabaseManager.

    Returns:
        ResetDatabaseResponse reporting confirmation message and duration.
    """
    duration_ms = await ctx.db_manager.reset_database()
    reset_upload_sandbox(ctx.settings.upload_sandbox_dir)
    return ResetDatabaseResponse(
        ok=True,
        message="MiniShop database has been reset to its clean seed state.",
        duration_ms=duration_ms,
    )
