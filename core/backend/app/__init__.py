"""Public barrel exports for the VVWA FastAPI backend application."""

from app.main import app, create_app

__all__ = ["app", "create_app"]
