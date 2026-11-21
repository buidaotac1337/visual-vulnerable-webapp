"""Integration tests for Lab 08 (08-race-condition): TOCTOU burst, FOR UPDATE, verify."""

import asyncio
import io
import shutil
import zipfile
from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/08-race-condition"

_SEED_USERS: dict[str, dict[str, Any]] = {
    "alice": {"id": 2, "username": "alice", "role": "customer", "balance": Decimal("500.00")},
    "bob": {"id": 3, "username": "bob", "role": "customer", "balance": Decimal("250.00")},
}
_SEED_COUPONS: list[dict[str, Any]] = [
    {"id": 1, "code": "WELCOME10", "discount_percent": 10, "max_uses": 1, "used_count": 0},
    {"id": 2, "code": "STUDENT20", "discount_percent": 20, "max_uses": 5, "used_count": 0},
]


class _TxCouponDb:
    """Transaction-scoped handle holding row locks until the transaction exits."""

    def __init__(self, parent: "_CouponDb") -> None:
        self._parent = parent
        self._held_locks: list[asyncio.Lock] = []

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        if "FROM coupons WHERE code = $1" in query and "FOR UPDATE" in query:
            code = str(args[0])
            lock = self._parent.lock_for(code)
            if lock not in self._held_locks:
                await lock.acquire()
                self._held_locks.append(lock)
        return await self._parent.fetch_one(query, *args)

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        return await self._parent.fetch_all(query, *args)

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        return await self._parent.fetch_val(query, *args)

    async def execute(self, query: str, *args: object) -> str:
        return await self._parent.execute(query, *args)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[LabDatabaseProtocol]:
        yield self

    def release_locks(self) -> None:
        for lock in reversed(self._held_locks):
            lock.release()
        self._held_locks.clear()


class _CouponDb:
    """In-memory MiniShop coupons/users DB simulating PostgreSQL FOR UPDATE row locks."""

    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.coupons: list[dict[str, Any]] = []
        self._locks: dict[str, asyncio.Lock] = {}
        self.reset()

    def reset(self) -> None:
        self.users = {name: dict(row) for name, row in _SEED_USERS.items()}
        self.coupons = [dict(row) for row in _SEED_COUPONS]
        self._locks = {str(row["code"]): asyncio.Lock() for row in _SEED_COUPONS}

    def lock_for(self, code: str) -> asyncio.Lock:
        return self._locks.setdefault(code, asyncio.Lock())

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        if "FROM users WHERE username = $1" in query:
            user = self.users.get(str(args[0]))
            return None if user is None else {k: user[k] for k in ("id", "username", "role")}
        assert "FROM coupons WHERE code = $1" in query
        coupon = next((c for c in self.coupons if c["code"] == str(args[0])), None)
        return None if coupon is None else dict(coupon)

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        _ = args
        assert "FROM coupons ORDER BY id" in query
        return [dict(c) for c in self.coupons]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        if query.startswith("SELECT balance FROM users"):
            user = next(u for u in self.users.values() if u["id"] == args[0])
            return float(user["balance"])
        if query.startswith("UPDATE coupons SET used_count"):
            coupon = next(c for c in self.coupons if c["id"] == args[0])
            coupon["used_count"] = int(coupon["used_count"]) + 1
            return int(coupon["used_count"])
        assert query.startswith("UPDATE users SET balance")
        bonus, user_id = args[0], args[1]
        assert isinstance(bonus, Decimal)
        user = next(u for u in self.users.values() if u["id"] == user_id)
        user["balance"] += bonus
        return float(user["balance"])

    async def execute(self, query: str, *args: object) -> str:
        _ = (query, args)
        return "OK"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        @asynccontextmanager
        async def _scope() -> AsyncIterator[LabDatabaseProtocol]:
            tx = _TxCouponDb(self)
            try:
                yield tx
            finally:
                tx.release_locks()

        return _scope()


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double serving a shared _CouponDb."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.db = _CouponDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        return self.db

    async def reset_database(self) -> float:
        self.db.reset()
        return 1.0


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> tuple[TestClient, _CouponDb]:
    settings = Settings(labs_dir=labs_dir, environment="test")
    manager = _StubDatabaseManager(settings)
    return TestClient(create_app(settings=settings, db_manager=manager)), manager.db


def test_lab_08_discovery_source_diff_and_zip() -> None:
    """Lab 08 has actors, verifyTests with concurrency, symmetric @step markers, and ZIP."""
    client, _ = _make_client()
    labs = client.get("/api/labs").json()["labs"]
    lab = next(item for item in labs if item["id"] == "08-race-condition")
    assert lab["actors"] == ["alice", "bob"]
    assert len(lab["samplePayloads"]) == 4
    assert len(lab["verifyTests"]) == 5
    assert lab["verifyTests"][1]["concurrency"] == 5
    assert lab["verifyTests"][1]["checkAction"] == "coupon_status"

    source = client.get(f"{_LAB}/source").json()
    shared_tags = {"require-session", "read-coupon", "check-limit", "consume-coupon"}
    assert shared_tags <= set(source["vulnerable"]["steps"])
    assert "race-window" in source["vulnerable"]["steps"]
    assert shared_tags <= set(source["secure"]["steps"])
    assert {"fe-send-burst", "fe-render-burst"} <= set(source["frontend"]["steps"])
    assert "+    async with db.transaction() as tx:" in source["diff"]
    assert "FOR UPDATE" in source["diff"]
    assert source["frontend_diff"] is None

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_08_load_coupons_and_coupon_status() -> None:
    """load_coupons and coupon_status reflect seed rows and actor DB balance."""
    client, _ = _make_client()
    loaded = client.post(
        f"{_LAB}/vulnerable/load_coupons",
        json={},
        headers={"X-VVWA-Actor": "alice"},
    ).json()
    assert loaded["data"]["balance"] == 500.0
    assert [c["code"] for c in loaded["data"]["coupons"]] == ["WELCOME10", "STUDENT20"]

    status = client.post(
        f"{_LAB}/secure/coupon_status",
        json={"code": "STUDENT20"},
        headers={"X-VVWA-Actor": "bob"},
    ).json()
    assert status["data"]["found"] is True
    assert status["data"]["max_uses"] == 5
    assert status["data"]["over_limit"] is False
    assert status["data"]["balance"] == 250.0


def test_lab_08_vulnerable_exploits_while_secure_serializes_concurrent_requests() -> None:
    """Vulnerable mode over-redeems WELCOME10; secure mode allows 1 and blocks 4."""
    client, db = _make_client()
    first = client.post(
        f"{_LAB}/vulnerable/apply_coupon",
        json={"code": "WELCOME10"},
        headers={"X-VVWA-Actor": "alice"},
    ).json()
    assert first["data"]["applied"] is True
    assert first["data"]["balance"] == 510.0

    # Reset and check secure mode handles single invalid & anonymous cleanly.
    db.reset()
    bad = client.post(
        f"{_LAB}/secure/apply_coupon",
        json={"code": "FAKE99"},
        headers={"X-VVWA-Actor": "bob"},
    ).json()
    assert bad["data"]["applied"] is False
    anon = client.post(f"{_LAB}/secure/apply_coupon", json={"code": "WELCOME10"}).json()
    assert anon["data"]["applied"] is False


def test_lab_08_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 3/5 unpatched and 5/5 once vulnerable.py adopts db.transaction()."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "08-race-condition", labs_dir / "08-race-condition")
    client, _ = _make_client(labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 3, 5)
    failed = {r["name"] for r in before["results"] if not r["passed"]}
    assert failed == {
        "Chặn race condition khi bắn đồng thời 5 request WELCOME10",
        "Chặn race condition khi bắn đồng thời 7 request STUDENT20 (giới hạn 5)",
    }

    backend = labs_dir / "08-race-condition" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True
    assert after["passed_count"] == 5
