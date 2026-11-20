"""Typed async database adapter exposed to isolated VVWA lab handlers."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol

import asyncpg


def _normalize_db_value(value: Any) -> Any:  # noqa: ANN401
    """Convert PostgreSQL-specific types into JSON-safe native Python primitives.

    Args:
        value: Raw value returned by asyncpg.

    Returns:
        Normalized value (Decimal -> float, datetime/date -> ISO string).
    """
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, list):
        return [_normalize_db_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalize_db_value(val) for key, val in value.items()}
    return value


def _normalize_record(record: Any) -> dict[str, Any]:  # noqa: ANN401
    """Convert an asyncpg Record (or mapping) into a JSON-safe dictionary.

    Args:
        record: Database row object supporting dict conversion.

    Returns:
        Dictionary with Decimal and datetime/date fields normalized.
    """
    return {key: _normalize_db_value(val) for key, val in dict(record).items()}


class LabDatabaseProtocol(Protocol):
    """Minimal pedagogical SQL interface provided to lab backend handlers."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Execute a query and return the first matching row as a dictionary.

        Args:
            query: SQL statement to execute.
            *args: Positional bind parameters ($1, $2, ...).

        Returns:
            Dictionary mapping column names to values, or None if no row matched.
        """
        ...

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Execute a query and return all matching rows as dictionaries.

        Args:
            query: SQL statement to execute.
            *args: Positional bind parameters ($1, $2, ...).

        Returns:
            List of row dictionaries.
        """
        ...

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Execute a query and return the first column of the first row.

        Args:
            query: SQL statement to execute.
            *args: Positional bind parameters ($1, $2, ...).

        Returns:
            Scalar value from the first column, or None when no row matched.
        """
        ...

    async def execute(self, query: str, *args: object) -> str:
        """Execute a DML statement and return the PostgreSQL status tag.

        Args:
            query: SQL statement to execute.
            *args: Positional bind parameters ($1, $2, ...).

        Returns:
            Command completion status string (e.g., 'INSERT 0 1').
        """
        ...


class AsyncpgLabDatabase:
    """Asyncpg-backed implementation of LabDatabaseProtocol using lab_app_user."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        """Bind the adapter to an active asyncpg connection pool.

        Args:
            pool: Restricted lab_app_user connection pool.
        """
        self._pool = pool

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Fetch a single row using the restricted lab_app_user pool.

        Args:
            query: SQL query text.
            *args: Positional bind parameters.

        Returns:
            JSON-safe row dictionary if found, otherwise None.
        """
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(query, *args)
            return _normalize_record(record) if record is not None else None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Fetch all matching rows using the restricted lab_app_user pool.

        Args:
            query: SQL query text.
            *args: Positional bind parameters.

        Returns:
            List of JSON-safe row dictionaries.
        """
        async with self._pool.acquire() as conn:
            records = await conn.fetch(query, *args)
            return [_normalize_record(record) for record in records]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Fetch a single scalar value using the restricted lab_app_user pool.

        Args:
            query: SQL query text.
            *args: Positional bind parameters.

        Returns:
            Normalized scalar result or None.
        """
        async with self._pool.acquire() as conn:
            return _normalize_db_value(await conn.fetchval(query, *args))

    async def execute(self, query: str, *args: object) -> str:
        """Execute a statement using the restricted lab_app_user pool.

        Args:
            query: SQL statement text.
            *args: Positional bind parameters.

        Returns:
            PostgreSQL status tag string.
        """
        async with self._pool.acquire() as conn:
            status: str = await conn.execute(query, *args)
            return status
