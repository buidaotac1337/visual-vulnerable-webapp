"""Pydantic schemas for system maintenance endpoints."""

from pydantic import BaseModel, Field


class ResetDatabaseResponse(BaseModel):
    """Response payload returned after replaying MiniShop seed data.

    Attributes:
        ok: Whether the database reset completed cleanly.
        message: Human-readable confirmation summary.
        duration_ms: Execution time of the reset transaction in milliseconds.
    """

    ok: bool = Field(default=True)
    message: str
    duration_ms: float
