"""Integration tests for Lab 03 (03-idor): discovery, ownership checks, and verify."""

import io
import shutil
import zipfile
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/03-idor"

_USERS = {"alice": {"id": 2, "username": "alice", "role": "customer"}}
_USERS["bob"] = {"id": 3, "username": "bob", "role": "customer"}
_ORDERS: list[dict[str, Any]] = [
    {
        "id": 1,
        "user_id": 2,
        "owner": "alice",
        "status": "paid",
        "total_amount": 89.0,
        "shipping_address": "123 Duong Le Loi",
        "created_at": "2026-11-20T00:00:00+00:00",
    },
    {
        "id": 2,
        "user_id": 3,
        "owner": "bob",
        "status": "shipped",
        "total_amount": 120.0,
        "shipping_address": "456 Pho Hue",
        "created_at": "2026-11-20T00:00:00+00:00",
    },
]
_ITEMS = {1: [{"name": "Ban phim", "quantity": 1, "unit_price": 89.0}]}
_ITEMS[2] = [{"name": "Tai nghe", "quantity": 1, "unit_price": 120.0}]


class _OrdersDb:
    """In-memory MiniShop subset answering the queries issued by Lab 03 handlers."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Resolve actor lookups and order lookups (with or without the owner filter)."""
        if "FROM users WHERE username = $1" in query:
            return _USERS.get(str(args[0]))
        assert "FROM orders o JOIN users" in query
        scoped = "AND o.user_id = $2" in query
        assert len(args) == (2 if scoped else 1)
        for order in _ORDERS:
            if order["id"] == args[0] and (not scoped or order["user_id"] == args[1]):
                return dict(order)
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return the user's order list or the items of one order."""
        if "FROM order_items" in query:
            return list(_ITEMS.get(int(str(args[0])), []))
        assert "FROM orders WHERE user_id = $1" in query
        return [
            {k: o[k] for k in ("id", "status", "total_amount", "created_at")}
            for o in _ORDERS
            if o["user_id"] == args[0]
        ]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Unused by Lab 03."""
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        """Unused by Lab 03."""
        _ = (query, args)
        return "OK"


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double backed by the read-only _OrdersDb."""

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the in-memory database."""
        return _OrdersDb()

    async def reset_database(self) -> float:
        """Nothing to reset: Lab 03 never writes."""
        return 1.0


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> TestClient:
    """Create a TestClient over labs_dir and the in-memory database."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    return TestClient(create_app(settings=settings, db_manager=_StubDatabaseManager(settings)))


def _call(
    client: TestClient,
    path: str,
    body: dict[str, Any],
    actor: str | None,
) -> dict[str, Any]:
    """POST a lab action as the given persona and return the JSON response."""
    headers = {"X-VVWA-Actor": actor} if actor else {}
    resp = client.post(f"{_LAB}/{path}", json=body, headers=headers)
    assert resp.status_code == 200
    result: dict[str, Any] = resp.json()
    return result


def test_lab_03_discovery_source_diff_and_zip() -> None:
    """Lab 03 has actors, steps in both modes, a diff on the owner filter, and no sink pair."""
    client = _make_client()
    lab = next(item for item in client.get("/api/labs").json()["labs"] if item["id"] == "03-idor")
    assert lab["actors"] == ["alice", "bob"]
    assert len(lab["verifyTests"]) == 7

    source = client.get(f"{_LAB}/source").json()
    tags = {"list-orders", "read-order-id", "require-session", "build-order-query", "fetch-order"}
    assert tags <= set(source["vulnerable"]["steps"]) and tags <= set(source["secure"]["steps"])
    assert {"fe-open-order", "fe-render-order"} <= set(source["frontend"]["steps"])
    assert '+        "WHERE o.id = $1 AND o.user_id = $2"' in source["diff"]
    assert source["frontend_diff"] is None

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_03_vulnerable_leaks_foreign_order() -> None:
    """Vulnerable mode returns bob's order to alice and flags it as exploited."""
    client = _make_client()
    own = _call(client, "vulnerable/view_order", {"order_id": 1}, "alice")
    assert own["meta"]["outcome"] == "normal"
    assert own["data"]["order"]["items"][0]["name"] == "Ban phim"
    assert "user_id" not in own["data"]["order"]

    leak = _call(client, "vulnerable/view_order", {"order_id": "2"}, "alice")
    assert leak["meta"]["outcome"] == "exploited"
    assert leak["data"]["order"]["shipping_address"] == "456 Pho Hue"
    fetch = next(s for s in leak["trace"] if s["tag"] == "fetch-order")
    assert fetch["status"] == "danger"
    assert leak["trace"][0]["tag"] == "engine-session"


def test_lab_03_secure_denies_foreign_order_like_missing_one() -> None:
    """Secure mode answers a foreign order exactly like a missing one."""
    client = _make_client()
    foreign = _call(client, "secure/view_order", {"order_id": 2}, "alice")
    missing = _call(client, "secure/view_order", {"order_id": 999}, "alice")
    assert foreign["meta"]["outcome"] == "blocked"
    assert foreign["data"] == {
        "found": False,
        "order": None,
        "error": "Không tìm thấy đơn hàng #2.",
    }
    assert missing["data"]["error"] == "Không tìm thấy đơn hàng #999."
    assert set(foreign["data"]) == set(missing["data"])

    anonymous = _call(client, "secure/view_order", {"order_id": 1}, None)
    assert anonymous["data"]["found"] is False
    assert [s["tag"] for s in anonymous["trace"]] == ["engine-session", "require-session"]


def test_lab_03_list_orders_is_scoped_to_session() -> None:
    """'My orders' only lists the session user's orders in both modes."""
    client = _make_client()
    for mode in ("vulnerable", "secure"):
        alice = _call(client, f"{mode}/list_orders", {"user_id": 3}, "alice")
        assert [o["id"] for o in alice["data"]["orders"]] == [1]
        assert _call(client, f"{mode}/list_orders", {}, None)["data"]["count"] == 0


def test_lab_03_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 5/7 before the fix and 7/7 once the owner check is added."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "03-idor", labs_dir / "03-idor")
    client = _make_client(labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 5, 7)
    failed = {r["name"] for r in before["results"] if not r["passed"]}
    assert failed == {"Alice không xem được đơn #2 của bob", "Bob không xem được đơn #1 của alice"}

    backend = labs_dir / "03-idor" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True and after["passed_count"] == 7
