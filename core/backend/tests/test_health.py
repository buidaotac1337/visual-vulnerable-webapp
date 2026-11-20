"""Smoke tests for the VVWA FastAPI health endpoint."""

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings


def test_health_endpoint_returns_ok() -> None:
    """Verify that GET /api/health responds with HTTP 200 and expected schema."""
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "0.1.0"
    assert "service" in payload
    assert "environment" in payload


def test_create_app_respects_settings_override() -> None:
    """Verify that custom Settings passed to create_app propagate to /api/health."""
    custom_settings = Settings(app_name="VVWA Test Engine", environment="ci-test")
    client = TestClient(create_app(settings=custom_settings))

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "VVWA Test Engine"
    assert payload["environment"] == "ci-test"
