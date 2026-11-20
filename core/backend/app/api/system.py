"""System maintenance API router (1-click MiniShop database reset)."""

from fastapi import APIRouter

from app.api.deps import DbManagerDep
from app.schemas import ResetDatabaseResponse

router = APIRouter(prefix="/api/system", tags=["system"])


@router.post("/reset-db", response_model=ResetDatabaseResponse)
async def reset_database_endpoint(db_manager: DbManagerDep) -> ResetDatabaseResponse:
    """Restore all MiniShop tables to their clean seeded state using lab_admin_user.

    Args:
        db_manager: Injected DatabaseManager controlling admin reset access.

    Returns:
        ResetDatabaseResponse reporting confirmation message and duration.
    """
    duration_ms = await db_manager.reset_database()
    return ResetDatabaseResponse(
        ok=True,
        message="MiniShop database has been reset to its clean seed state.",
        duration_ms=duration_ms,
    )
