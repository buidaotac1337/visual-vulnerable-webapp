"""Integration tests for Lab 04 (04-business-logic): checkout pricing, validation, verify."""

import io
import shutil
import zipfile
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/04-business-logic"

_PRODUCTS = [
    {"id": 1, "name": "Ban phim", "price": 89.0, "stock": 25},
    {"id": 2, "name": "Chuot", "price": 45.0, "stock": 40},
    {"id": 3, "name": "Tai nghe", "price": 120.0, "stock": 15},
]
_SEED_USERS = {
    "alice": {"id": 2, "username": "alice", "role": "customer", "balance": Decimal(500)},
    "bob": {"id": 3, "username": "bob", "role": "customer", "balance": Decimal(250)},
}


class _ShopDb:
    """In-memory MiniShop subset answering the queries issued by Lab 04 handlers."""

    def __init__(self) -> None:
        """Start from the seed state."""
        self.users: dict[str, dict[str, Any]] = {}
        self.orders: list[dict[str, Any]] = []
        self.items: list[tuple[object, ...]] = []
        self.reset()

    def reset(self) -> None:
        """Restore the seed balances and drop every order."""
        self.users = {name: dict(user) for name, user in _SEED_USERS.items()}
        self.orders.clear()
        self.items.clear()

    def _user(self, user_id: object) -> dict[str, Any]:
        """Return the user row with the given id."""
        return next(u for u in self.users.values() if u["id"] == user_id)

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Resolve the engine's actor lookup."""
        assert "FROM users WHERE username = $1" in query
        user = self.users.get(str(args[0]))
        return None if user is None else {k: user[k] for k in ("id", "username", "role")}

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return the whole catalog or the products of a cart."""
        if "WHERE id = ANY($1::int[])" in query:
            assert isinstance(args[0], list)
            return [dict(p) for p in _PRODUCTS if p["id"] in args[0]]
        assert "FROM products ORDER BY id" in query
        return [dict(p) for p in _PRODUCTS]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Read a balance, charge it conditionally, or insert an order."""
        if query.startswith("SELECT balance"):
            return float(self._user(args[0])["balance"])
        if query.startswith("UPDATE users SET balance"):
            amount, user = args[0], self._user(args[1])
            assert isinstance(amount, Decimal)
            if user["balance"] < amount:
                return None
            user["balance"] -= amount
            return float(user["balance"])
        assert query.startswith("INSERT INTO orders")
        self.orders.append({"user_id": args[0], "total_amount": args[1]})
        return len(self.orders) + 2

    async def execute(self, query: str, *args: object) -> str:
        """Record an order line."""
        assert query.startswith("INSERT INTO order_items")
        self.items.append(args)
        return "INSERT 0 1"


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double whose reset restores the seed state."""

    def __init__(self, settings: Settings) -> None:
        """Create the manager with a fresh in-memory shop."""
        super().__init__(settings)
        self.db = _ShopDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the in-memory database."""
        return self.db

    async def reset_database(self) -> float:
        """Restore seed balances and drop orders."""
        self.db.reset()
        return 1.0


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> tuple[TestClient, _ShopDb]:
    """Create a TestClient over labs_dir and return it with its in-memory database."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    manager = _StubDatabaseManager(settings)
    return TestClient(create_app(settings=settings, db_manager=manager)), manager.db


def _checkout(client: TestClient, mode: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    """POST a checkout as alice and return the JSON response."""
    resp = client.post(
        f"{_LAB}/{mode}/checkout",
        json={"items": items},
        headers={"X-VVWA-Actor": "alice"},
    )
    assert resp.status_code == 200
    result: dict[str, Any] = resp.json()
    return result


def test_lab_04_discovery_source_diff_and_zip() -> None:
    """Lab 04 has actors, steps in both modes, a diff on the cart model, and no sink pair."""
    client, _ = _make_client()
    labs = client.get("/api/labs").json()["labs"]
    lab = next(item for item in labs if item["id"] == "04-business-logic")
    assert lab["actors"] == ["alice", "bob"]
    assert len(lab["verifyTests"]) == 7

    source = client.get(f"{_LAB}/source").json()
    tags = {"cart-model", "require-session", "parse-cart", "load-products", "price-cart"}
    tags |= {"charge-balance", "insert-order"}
    assert tags <= set(source["vulnerable"]["steps"]) and tags <= set(source["secure"]["steps"])
    assert {"fe-submit-cart", "fe-render-result"} <= set(source["frontend"]["steps"])
    assert "+    quantity: int = Field(gt=0)" in source["diff"]
    assert "-    price: float" in source["diff"]
    assert source["frontend_diff"] is None

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_04_vulnerable_trusts_client_price_and_quantity() -> None:
    """Vulnerable mode charges the client's price and refunds negative quantities."""
    client, db = _make_client()
    cheap = _checkout(client, "vulnerable", [{"product_id": 3, "quantity": 1, "price": 1}])
    assert cheap["meta"]["outcome"] == "exploited"
    assert cheap["data"]["order"]["total_amount"] == 1.0
    assert db.items[-1][3] == Decimal("1.00")

    refund = _checkout(client, "vulnerable", [{"product_id": 2, "quantity": -5, "price": 45}])
    assert refund["meta"]["outcome"] == "exploited"
    assert refund["data"]["balance"] == 724.0
    steps = {s["tag"]: s for s in refund["trace"]}
    assert steps["charge-balance"]["status"] == "danger"
    assert steps["price-cart"]["title"] == "Tổng tiền tính từ giá client gửi: -$225.00"
    assert "số lượng -5 (phải > 0)" in steps["price-cart"]["detail"]
    assert "DB" not in steps["price-cart"]["detail"]


def test_lab_04_secure_reprices_and_rejects_bad_quantities() -> None:
    """Secure mode ignores client prices and rejects non-positive quantities."""
    client, db = _make_client()
    cheap = _checkout(client, "secure", [{"product_id": 3, "quantity": 1, "price": 1}])
    assert cheap["meta"]["outcome"] == "blocked"
    assert cheap["data"]["order"]["total_amount"] == 120.0
    assert cheap["data"]["balance"] == 380.0

    for quantity in (-5, 0):
        rejected = _checkout(client, "secure", [{"product_id": 2, "quantity": quantity}])
        assert rejected["meta"]["outcome"] == "blocked"
        assert rejected["data"]["placed"] is False
        assert "items.0.quantity" in rejected["data"]["error"]
    assert len(db.orders) == 1

    missing = _checkout(client, "secure", [{"product_id": 99, "quantity": 1}])
    assert missing["data"]["error"] == "Sản phẩm id=99 không tồn tại."
    stock = _checkout(client, "secure", [{"product_id": 3, "quantity": 16}])
    assert "chỉ còn 15" in stock["data"]["error"]
    split = [{"product_id": 3, "quantity": 10}, {"product_id": 3, "quantity": 10}]
    assert "chỉ còn 15" in _checkout(client, "secure", split)["data"]["error"]


def test_lab_04_load_shop_returns_catalog_and_session_balance() -> None:
    """load_shop lists products and the balance of the session user only."""
    client, _ = _make_client()
    shop = client.post(f"{_LAB}/vulnerable/load_shop", json={}, headers={"X-VVWA-Actor": "bob"})
    assert shop.json()["data"]["balance"] == 250.0
    assert len(shop.json()["data"]["products"]) == 3
    anonymous = client.post(f"{_LAB}/secure/load_shop", json={}).json()
    assert anonymous["data"]["balance"] is None


def test_lab_04_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 3/7 before the fix and 7/7 once prices and quantities are fixed."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "04-business-logic", labs_dir / "04-business-logic")
    client, _ = _make_client(labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 3, 7)
    failed = {r["name"] for r in before["results"] if not r["passed"]}
    assert failed == {
        "Giá do trình duyệt gửi lên bị bỏ qua",
        "Số lượng âm bị từ chối",
        "Số lượng 0 bị từ chối",
        "Món số lượng âm không được bù trừ vào tổng tiền",
    }

    backend = labs_dir / "04-business-logic" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True and after["passed_count"] == 7
