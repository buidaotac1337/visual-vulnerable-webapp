"""Pydantic response schemas for system health endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Payload returned by the backend health-check endpoint.

    Attributes:
        status: Operational status indicator.
        service: Name of the responding service.
        version: Current backend semantic version.
        environment: Active runtime environment name.
    """

    status: Literal["ok"] = Field(default="ok")
    service: str
    version: str
    environment: str
