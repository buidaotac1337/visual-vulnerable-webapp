"""Unit tests for DatabaseManager, AsyncpgLabDatabase normalization, and reset-db."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import create_app
from app.core import DatabaseUnavailableError, Settings
from app.db import AsyncpgLabDatabase, DatabaseManager


class _OkResetManager(DatabaseManager):
    """Test double simulating a fast successful PostgreSQL seed replay."""

    async def reset_database(self) -> float:
        """Return a deterministic synthetic reset duration."""
        return 12.34


class _FailingResetManager(DatabaseManager):
    """Test double simulating an unreachable PostgreSQL server."""

    async def reset_database(self) -> float:
        """Raise DatabaseUnavailableError to exercise HTTP 503 mapping."""
        msg = "PostgreSQL connection refused"
        raise DatabaseUnavailableError(msg)


def test_reset_db_endpoint_returns_ok() -> None:
    """Verify POST /api/system/reset-db returns HTTP 200 with duration_ms."""
    settings = Settings(environment="test")
    client = TestClient(create_app(settings=settings, db_manager=_OkResetManager(settings)))

    response = client.post("/api/system/reset-db")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["duration_ms"] == 12.34


def test_reset_db_endpoint_returns_503_when_db_unavailable() -> None:
    """Verify DatabaseUnavailableError maps cleanly to HTTP 503."""
    settings = Settings(environment="test")
    client = TestClient(create_app(settings=settings, db_manager=_FailingResetManager(settings)))

    response = client.post("/api/system/reset-db")

    assert response.status_code == 503
    assert "connection refused" in response.json()["detail"].lower()


def test_settings_rejects_min_pool_greater_than_max_pool() -> None:
    """Ensure Settings validator rejects inverted asyncpg pool bounds."""
    with pytest.raises(ValidationError):
        Settings(db_pool_min_size=8, db_pool_max_size=2)


async def test_database_manager_reset_handles_missing_seed_and_passes_timeout(
    tmp_path: Path,
) -> None:
    """Verify missing seed.sql raises DatabaseUnavailableError and connect receives timeout."""
    missing_settings = Settings(seed_sql_path=tmp_path / "missing.sql")
    with pytest.raises(DatabaseUnavailableError):
        await DatabaseManager(missing_settings).reset_database()

    seed_file = tmp_path / "seed.sql"
    seed_file.write_text("SELECT 1;", encoding="utf-8")
    valid_settings = Settings(seed_sql_path=seed_file, db_connect_timeout=3.5)

    fake_conn = MagicMock()
    fake_conn.execute = AsyncMock(return_value="SELECT 1")
    fake_conn.close = AsyncMock()

    @asynccontextmanager
    async def _tx() -> Any:  # noqa: ANN401
        yield

    fake_conn.transaction = _tx

    with patch("asyncpg.connect", new=AsyncMock(return_value=fake_conn)) as mock_connect:
        duration = await DatabaseManager(valid_settings).reset_database()

    assert duration >= 0.0
    mock_connect.assert_awaited_once_with(dsn=valid_settings.admin_database_url, timeout=3.5)
    fake_conn.execute.assert_awaited_once_with("SELECT 1;")
    fake_conn.close.assert_awaited_once()


async def test_asyncpg_lab_database_normalizes_decimal_and_datetime() -> None:
    """Verify AsyncpgLabDatabase converts Decimal -> float and datetime -> ISO string."""
    now = datetime(2026, 11, 21, 3, 0, tzinfo=UTC)
    fake_conn = MagicMock()
    fake_conn.fetchrow = AsyncMock(
        return_value={"id": 1, "price": Decimal("89.55"), "created_at": now},
    )
    fake_conn.fetchval = AsyncMock(return_value=Decimal("120.00"))

    @asynccontextmanager
    async def _acquire() -> Any:  # noqa: ANN401
        yield fake_conn

    fake_pool = MagicMock()
    fake_pool.acquire = _acquire

    db = AsyncpgLabDatabase(fake_pool)
    row = await db.fetch_one("SELECT * FROM products WHERE id = $1", 1)
    scalar = await db.fetch_val("SELECT price FROM products WHERE id = $1", 1)

    assert row == {"id": 1, "price": 89.55, "created_at": "2026-11-21T03:00:00+00:00"}
    assert isinstance(row["price"], float)
    assert scalar == 120.0
    assert isinstance(scalar, float)
