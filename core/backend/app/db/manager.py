"""Lifecycle manager for least-privilege app pool and admin DB reset."""

import asyncio
from time import perf_counter

import asyncpg

from app.core import DatabaseUnavailableError, Settings
from app.db.client import AsyncpgLabDatabase, LabDatabaseProtocol


class DatabaseManager:
    """Manage PostgreSQL connections with strict privilege separation.

    Lab endpoints receive an AsyncpgLabDatabase backed by the restricted
    `lab_app_user` pool. Only `reset_database` opens a short-lived connection
    as `lab_admin_user` to replay `core/postgres/seed.sql`.
    """

    def __init__(self, settings: Settings) -> None:
        """Initialize the manager without opening network connections eagerly.

        Args:
            settings: Runtime settings providing DSNs, pool sizes, and seed path.
        """
        self._settings = settings
        self._pool: asyncpg.Pool | None = None
        self._pool_lock = asyncio.Lock()
        self._reset_lock = asyncio.Lock()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return a ready LabDatabaseProtocol backed by the lab_app_user pool.

        Returns:
            AsyncpgLabDatabase instance sharing the managed pool.

        Raises:
            DatabaseUnavailableError: If PostgreSQL cannot be reached.
        """
        pool = await self._ensure_pool()
        return AsyncpgLabDatabase(pool)

    async def _ensure_pool(self) -> asyncpg.Pool:
        """Lazily initialize the lab_app_user asyncpg pool under an async lock.

        Returns:
            Initialized asyncpg Pool instance.

        Raises:
            DatabaseUnavailableError: If creating the pool fails.
        """
        if self._pool is not None:
            return self._pool
        async with self._pool_lock:
            if self._pool is None:
                try:
                    self._pool = await asyncpg.create_pool(
                        dsn=self._settings.database_url,
                        min_size=self._settings.db_pool_min_size,
                        max_size=self._settings.db_pool_max_size,
                        timeout=self._settings.db_connect_timeout,
                    )
                except (OSError, TimeoutError, asyncpg.PostgresError) as exc:
                    msg = f"Unable to connect to PostgreSQL lab pool: {exc}"
                    raise DatabaseUnavailableError(msg) from exc
            return self._pool

    async def reset_database(self) -> float:
        """Replay seed.sql inside a serialized transaction using lab_admin_user.

        Returns:
            Elapsed execution duration in milliseconds.

        Raises:
            DatabaseUnavailableError: If seed.sql is missing or execution fails.
        """
        seed_path = self._settings.seed_sql_path
        if not seed_path.is_file():
            msg = f"Seed SQL file not found at '{seed_path}'."
            raise DatabaseUnavailableError(msg)

        seed_sql = seed_path.read_text(encoding="utf-8")
        async with self._reset_lock:
            started = perf_counter()
            conn: asyncpg.Connection | None = None
            try:
                conn = await asyncpg.connect(
                    dsn=self._settings.admin_database_url,
                    timeout=self._settings.db_connect_timeout,
                )
                async with conn.transaction():
                    await conn.execute(seed_sql)
            except (OSError, TimeoutError, asyncpg.PostgresError) as exc:
                msg = f"Database reset failed: {exc}"
                raise DatabaseUnavailableError(msg) from exc
            finally:
                if conn is not None:
                    await conn.close()
            return round((perf_counter() - started) * 1000.0, 2)

    async def close(self) -> None:
        """Close the managed lab_app_user connection pool on app shutdown."""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
