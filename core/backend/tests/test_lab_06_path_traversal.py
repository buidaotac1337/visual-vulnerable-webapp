"""Integration tests for Lab 06 (06-path-traversal): invoice files, traversal, verify."""

import io
import shutil
import zipfile
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/06-path-traversal"

_USERS: list[dict[str, Any]] = [
    {"id": 2, "username": "alice", "email": "alice@minishop.local", "balance": 500.0},
    {"id": 3, "username": "bob", "email": "bob@minishop.local", "balance": 250.0},
]
_SEED_ORDERS: list[dict[str, Any]] = [
    {"id": 1, "user_id": 2, "status": "paid", "total_amount": 89.0, "shipping_address": "Q1"},
    {"id": 2, "user_id": 3, "status": "shipped", "total_amount": 120.0, "shipping_address": "HN"},
]


class _ShopDb:
    """In-memory MiniShop subset answering the queries issued by Lab 06 handlers."""

    def __init__(self) -> None:
        """Start from the seed orders."""
        self.orders: list[dict[str, Any]] = [dict(o) for o in _SEED_ORDERS]

    def _username(self, user_id: object) -> str:
        """Return the username of a user id."""
        return str(next(u["username"] for u in _USERS if u["id"] == user_id))

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Resolve the engine's actor lookup."""
        assert "WHERE username = $1" in query
        user = next((u for u in _USERS if u["username"] == args[0]), None)
        return None if user is None else {"id": user["id"], "username": args[0], "role": "customer"}

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return all orders, one user's orders, or the user export."""
        if query.startswith("SELECT username, email, balance"):
            return [{k: u[k] for k in ("username", "email", "balance")} for u in _USERS]
        if "WHERE user_id = $1" in query:
            return [o for o in self.orders if o["user_id"] == args[0]]
        assert "JOIN users u" in query
        return [{**o, "username": self._username(o["user_id"])} for o in self.orders]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Answer the invoice ownership check."""
        assert "WHERE id = $1 AND user_id = $2" in query
        owned = any(o["id"] == args[0] and o["user_id"] == args[1] for o in self.orders)
        return 1 if owned else None

    async def execute(self, query: str, *args: object) -> str:
        """Unused by Lab 06."""
        _ = (query, args)
        return "OK"


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double whose reset restores the seed orders."""

    def __init__(self, settings: Settings) -> None:
        """Create the manager with a fresh in-memory shop."""
        super().__init__(settings)
        self.db = _ShopDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the in-memory database."""
        return self.db

    async def reset_database(self) -> float:
        """Restore the seed orders."""
        self.db.orders = [dict(o) for o in _SEED_ORDERS]
        return 1.0


@pytest.fixture(autouse=True)
def _sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the lab's file sandbox at a fresh temporary folder."""
    base = tmp_path / "sandbox"
    monkeypatch.setenv("VVWA_LAB06_DIR", str(base))
    return base


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> tuple[TestClient, _ShopDb]:
    """Create a TestClient over labs_dir and return it with its in-memory database."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    manager = _StubDatabaseManager(settings)
    return TestClient(create_app(settings=settings, db_manager=manager)), manager.db


def _download(client: TestClient, mode: str, file: str, actor: str = "alice") -> dict[str, Any]:
    """POST download_invoice as the given persona and return the JSON response."""
    resp = client.post(
        f"{_LAB}/{mode}/download_invoice",
        json={"file": file},
        headers={"X-VVWA-Actor": actor},
    )
    assert resp.status_code == 200
    result: dict[str, Any] = resp.json()
    return result


def test_lab_06_discovery_source_diff_and_zip() -> None:
    """Lab 06 has actors, steps in both modes, a diff on the name check, and no sink pair."""
    client, _ = _make_client()
    labs = client.get("/api/labs").json()["labs"]
    lab = next(item for item in labs if item["id"] == "06-path-traversal")
    assert lab["actors"] == ["alice", "bob"]
    assert len(lab["verifyTests"]) == 7

    source = client.get(f"{_LAB}/source").json()
    tags = {"read-file-name", "require-session", "build-path", "read-file"}
    assert tags <= set(source["vulnerable"]["steps"]) and tags <= set(source["secure"]["steps"])
    assert {"validate-name", "check-owner"} <= set(source["secure"]["steps"])
    assert {"fe-request-file", "fe-render-file"} <= set(source["frontend"]["steps"])
    assert "+    real = (invoice_dir / name).resolve()" in source["diff"]
    assert source["frontend_diff"] is None

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_06_vulnerable_reads_files_outside_the_invoice(_sandbox: Path) -> None:
    """Vulnerable mode returns config, export, foreign invoices, and caps what it reads."""
    client, _ = _make_client()
    own = _download(client, "vulnerable", "INV-0001.txt")
    assert own["meta"]["outcome"] == "normal"
    assert "Đơn hàng #1 của alice" in own["data"]["content"]

    for name, marker in [
        ("../config/secrets.env", "MINISHOP_ADMIN_TOKEN"),
        ("export.csv", "bob@minishop.local"),
        ("INV-0002.txt", "Đơn hàng #2 của bob"),
    ]:
        leak = _download(client, "vulnerable", name)
        assert leak["meta"]["outcome"] == "exploited", name
        assert marker in leak["data"]["content"]
        assert leak["trace"][-1]["status"] == "danger"

    (_sandbox / "big.txt").write_text("x" * 10_000, encoding="utf-8")
    assert len(_download(client, "vulnerable", "../big.txt")["data"]["content"]) == 4096


def test_lab_06_secure_allows_only_own_invoices_and_hides_why(_sandbox: Path) -> None:
    """Secure mode denies every other file with the same 'not found' shape."""
    client, db = _make_client()
    assert _download(client, "secure", "INV-0002.txt", "bob")["data"]["found"] is True
    for name in ["../config/secrets.env", "....//config/secrets.env", "export.csv", "INV-0002.txt"]:
        denied = _download(client, "secure", name)
        assert denied["meta"]["outcome"] == "blocked", name
        assert denied["data"] == {
            "found": False,
            "file": name,
            "content": None,
            "error": f"Không có hóa đơn {name}.",
        }

    db.orders.pop()
    _download(client, "secure", "INV-0001.txt")
    assert not (_sandbox / "invoices" / "INV-0002.txt").exists()
    anonymous = client.post(f"{_LAB}/secure/download_invoice", json={"file": "INV-0001.txt"})
    assert anonymous.json()["data"]["found"] is False


def test_lab_06_list_invoices_is_scoped_to_session() -> None:
    """list_invoices only returns the session user's invoice files."""
    client, _ = _make_client()
    headers = {"X-VVWA-Actor": "bob"}
    listed = client.post(f"{_LAB}/vulnerable/list_invoices", json={}, headers=headers).json()
    assert listed["data"]["invoices"] == [
        {"order_id": 2, "file": "INV-0002.txt", "total_amount": 120.0},
    ]
    anonymous = client.post(f"{_LAB}/secure/list_invoices", json={}).json()
    assert anonymous["data"]["invoices"] == []


def test_lab_06_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 4/7 before the fix and 7/7 with the secure handler."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "06-path-traversal", labs_dir / "06-path-traversal")
    client, _ = _make_client(labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 4, 7)
    failed = {r["name"] for r in before["results"] if not r["passed"]}
    assert failed == {
        "Không đi ra khỏi thư mục hóa đơn bằng ../",
        "Không tải được file không phải hóa đơn trong cùng thư mục",
        "Không tải được hóa đơn của người khác",
    }

    backend = labs_dir / "06-path-traversal" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True and after["passed_count"] == 7
