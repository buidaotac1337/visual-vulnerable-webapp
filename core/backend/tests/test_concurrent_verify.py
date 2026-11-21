"""Unit tests for AsyncpgLabDatabase.transaction() and concurrent/multi-step verifier (ADR-0008)."""

import asyncio
import json
from contextlib import AbstractAsyncContextManager, asynccontextmanager, nullcontext
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.db import AsyncpgLabDatabase, LabDatabaseProtocol
from app.schemas import BackendVerifyTest
from app.services import verify_lab


class _MemoryStateDb:
    """In-memory DB with an optional asyncio.Barrier to prove concurrent execution."""

    def __init__(self, barrier_parties: int = 0) -> None:
        self.count = 0
        self.barrier = asyncio.Barrier(barrier_parties) if barrier_parties > 0 else None

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        _ = (query, args)
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        _ = (query, args)
        return self.count

    async def execute(self, query: str, *args: object) -> str:
        _ = args
        if self.barrier is not None and query == "BARRIER":
            async with asyncio.timeout(1.0):
                idx = await self.barrier.wait()
            self.count += 1
            return str(idx)
        self.count += 1
        return "UPDATE 1"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        return nullcontext(self)


def _write_demo_lab(tmp_path: Path, verify_tests: list[dict[str, Any]], code: str) -> Path:
    """Create a minimal demo lab with the provided verifyTests and handler code."""
    labs_dir = tmp_path / "labs"
    lab_dir = labs_dir / "00-demo-race"
    (lab_dir / "backend").mkdir(parents=True)
    meta = {
        "id": "00-demo-race",
        "title": "Demo Race",
        "category": "Concurrency",
        "difficulty": "Trung binh",
        "summary": "Demo concurrent verify.",
        "safetyPattern": "Use db.transaction().",
        "samplePayloads": [],
        "verifyTests": verify_tests,
    }
    (lab_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    (lab_dir / "backend" / "vulnerable.py").write_text(code, encoding="utf-8")
    (lab_dir / "backend" / "secure.py").write_text(code, encoding="utf-8")
    return labs_dir


async def test_asyncpg_lab_database_transaction_pins_connection_and_savepoint() -> None:
    """transaction() acquires one connection, normalizes results, and uses savepoints on nesting."""
    acquire_calls = 0
    tx_calls = 0
    fake_conn = MagicMock()
    fake_conn.fetchrow = AsyncMock(return_value={"id": 1, "balance": Decimal("510.00")})
    fake_conn.fetch = AsyncMock(return_value=[{"code": "WELCOME10", "discount_percent": 10}])
    fake_conn.fetchval = AsyncMock(return_value=Decimal("520.00"))
    fake_conn.execute = AsyncMock(return_value="UPDATE 1")

    @asynccontextmanager
    async def _conn_tx() -> Any:  # noqa: ANN401
        nonlocal tx_calls
        tx_calls += 1
        yield

    @asynccontextmanager
    async def _acquire() -> Any:  # noqa: ANN401
        nonlocal acquire_calls
        acquire_calls += 1
        yield fake_conn

    fake_conn.transaction = _conn_tx
    fake_pool = MagicMock()
    fake_pool.acquire = _acquire

    db = AsyncpgLabDatabase(fake_pool)
    async with db.transaction() as tx:
        row = await tx.fetch_one("SELECT id, balance FROM users WHERE id = $1", 2)
        rows = await tx.fetch_all("SELECT code, discount_percent FROM coupons")
        val = await tx.fetch_val("UPDATE users SET balance = balance + 10 RETURNING balance")
        async with tx.transaction() as nested:
            tag = await nested.execute("UPDATE coupons SET used_count = 1")

    assert acquire_calls == 1
    assert tx_calls == 2
    assert row == {"id": 1, "balance": 510.0}
    assert rows == [{"code": "WELCOME10", "discount_percent": 10}]
    assert val == 520.0
    assert tag == "UPDATE 1"


def test_backend_verify_schema_concurrency_bounds_and_aliases() -> None:
    """BackendVerifyTest validates concurrency in 1..20 and supports camelCase aliases."""
    default_test = BackendVerifyTest(name="t", action="go", input={}, expect={})
    assert default_test.concurrency == 1
    assert default_test.check_action is None
    assert default_test.check_input == {}

    alias_test = BackendVerifyTest.model_validate(
        {
            "name": "burst",
            "action": "go",
            "input": {"a": 1},
            "expect": {"total": 20},
            "concurrency": 20,
            "checkAction": "inspect",
            "checkInput": {"code": "X"},
        },
    )
    assert alias_test.concurrency == 20
    assert alias_test.check_action == "inspect"
    assert alias_test.check_input == {"code": "X"}

    for bad_concurrency in (0, 21):
        with pytest.raises(ValidationError):
            BackendVerifyTest(
                name="bad",
                action="go",
                input={},
                expect={},
                concurrency=bad_concurrency,
            )


async def test_verify_single_step_with_check_action_and_failures(tmp_path: Path) -> None:
    """Single test with checkAction merges check data and fails if checkAction errors."""
    code = """
async def inc(payload, db):
    await db.execute("INC")
    return {"data": {"ok": True}, "meta": {"outcome": "normal"}, "trace": []}

async def status(payload, db):
    if payload.get("fail"):
        raise RuntimeError("check boom")
    total = await db.fetch_val("COUNT")
    return {"data": {"count": total}, "meta": {"outcome": "normal"}, "trace": []}
"""
    tests = [
        {
            "name": "Single with check",
            "action": "inc",
            "input": {},
            "checkAction": "status",
            "checkInput": {"fail": False},
            "expect": {"ok": True, "check": {"count": 1}},
        },
        {
            "name": "Single with failing check",
            "action": "inc",
            "input": {},
            "checkAction": "status",
            "checkInput": {"fail": True},
            "expect": {"ok": True},
        },
        {
            "name": "Single with missing checkAction",
            "action": "inc",
            "input": {},
            "checkAction": "does_not_exist",
            "expect": {"ok": True},
        },
    ]
    labs_dir = _write_demo_lab(tmp_path, tests, code)
    db = _MemoryStateDb()

    async def _reset() -> float:
        db.count = 0
        return 1.0

    report = await verify_lab(labs_dir, "00-demo-race", db, reset_fn=_reset)
    assert report.total == 3
    assert report.passed is False
    assert report.passed_count == 1
    assert report.results[0].passed is True
    assert report.results[0].actual == {"ok": True, "check": {"count": 1}}
    assert report.results[1].passed is False
    assert "RuntimeError: check boom" in (report.results[1].error or "")
    assert report.results[2].passed is False
    assert "does_not_exist" in (report.results[2].error or "")


async def test_verify_concurrent_burst_runs_parallel_and_handles_errors(tmp_path: Path) -> None:
    """Concurrent verify runs all N requests in parallel and grades outcomes + checkAction."""
    code = """
async def hit(payload, db):
    if payload.get("boom"):
        raise ValueError("handler crashed")
    tag = await db.execute("BARRIER")
    idx = int(tag)
    outcome = "normal" if idx == 0 else "blocked"
    return {"data": {"slot": idx}, "meta": {"outcome": outcome}, "trace": []}

async def status(payload, db):
    if payload.get("fail"):
        raise RuntimeError("check failed")
    val = await db.fetch_val("COUNT")
    return {"data": {"count": val}, "meta": {"outcome": "normal"}, "trace": []}
"""
    tests = [
        {
            "name": "Parallel barrier burst",
            "action": "hit",
            "input": {},
            "concurrency": 4,
            "checkAction": "status",
            "expect": {
                "total": 4,
                "outcomes": {"normal": 1, "blocked": 3, "exploited": 0, "error": 0},
                "check": {"count": 4},
            },
        },
        {
            "name": "Burst fails on handler runtime error",
            "action": "hit",
            "input": {"boom": True},
            "concurrency": 3,
            "expect": {"total": 3},
        },
        {
            "name": "Burst fails when action is missing",
            "action": "missing_action",
            "input": {},
            "concurrency": 2,
            "expect": {"total": 2},
        },
        {
            "name": "Burst fails when checkAction errors",
            "action": "hit",
            "input": {},
            "concurrency": 4,
            "checkAction": "status",
            "checkInput": {"fail": True},
            "expect": {"total": 4},
        },
    ]
    labs_dir = _write_demo_lab(tmp_path, tests, code)
    db = _MemoryStateDb(barrier_parties=4)

    async def _reset() -> float:
        db.count = 0
        return 1.0

    report = await verify_lab(labs_dir, "00-demo-race", db, reset_fn=_reset)
    assert report.total == 4
    assert report.passed_count == 1
    assert report.results[0].passed is True
    assert len(report.results[0].actual["responses"]) == 4
    assert report.results[1].passed is False
    assert "ValueError: handler crashed" in (report.results[1].error or "")
    assert report.results[1].actual["outcomes"]["error"] == 3
    assert report.results[2].passed is False
    assert "missing_action" in (report.results[2].error or "")
    assert report.results[3].passed is False
    assert "RuntimeError: check failed" in (report.results[3].error or "")
