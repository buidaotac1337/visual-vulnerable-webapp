"""Integration tests for Lab 05 (05-mass-assignment): profile updates, schema, verify."""

import io
import re
import shutil
import zipfile
from contextlib import AbstractAsyncContextManager, nullcontext
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/05-mass-assignment"
_ASSIGNMENT_RE = re.compile(r"(\w+) = (?:CAST\()?\$(\d+)")

_SEED_USERS: list[dict[str, Any]] = [
    {"id": 2, "username": "alice", "email": "alice@minishop.local", "role": "customer"},
    {"id": 3, "username": "bob", "email": "bob@minishop.local", "role": "customer"},
]
_SEED_BALANCES: dict[int, float] = {2: 500.0, 3: 250.0}


class _UsersDb:
    """In-memory users table answering the queries issued by Lab 05 handlers."""

    def __init__(self) -> None:
        """Start from the seed users."""
        self.users: list[dict[str, Any]] = []
        self.reset()

    def reset(self) -> None:
        """Restore the seed users."""
        self.users = [{**u, "balance": _SEED_BALANCES[u["id"]]} for u in _SEED_USERS]

    def _by(self, key: str, value: object) -> dict[str, Any] | None:
        """Return the user whose column equals value."""
        return next((u for u in self.users if u[key] == value), None)

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Resolve the engine's actor lookup and profile reads."""
        if "WHERE username = $1" in query:
            user = self._by("username", args[0])
            return None if user is None else {k: user[k] for k in ("id", "username", "role")}
        assert query.startswith("SELECT id, username, email, role, balance FROM users")
        user = self._by("id", args[0])
        return None if user is None else dict(user)

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Unused by Lab 05."""
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Answer the 'email used by another account' check."""
        assert "WHERE email = $1 AND id <> $2" in query
        user = self._by("email", args[0])
        return 1 if user is not None and user["id"] != args[1] else None

    async def execute(self, query: str, *args: object) -> str:
        """Apply an UPDATE whose SET clause names its columns and parameters."""
        assert query.startswith("UPDATE users SET")
        set_clause, where = query.split(" WHERE id = $")
        user = self._by("id", args[int(where) - 1])
        assert user is not None
        for column, index in _ASSIGNMENT_RE.findall(set_clause):
            value = args[int(index) - 1]
            user[column] = float(Decimal(str(value))) if column == "balance" else value
        return "UPDATE 1"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        """Return a no-op async transaction context for protocol compliance."""
        return nullcontext(self)


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double whose reset restores the seed users."""

    def __init__(self, settings: Settings) -> None:
        """Create the manager with a fresh in-memory users table."""
        super().__init__(settings)
        self.db = _UsersDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the in-memory database."""
        return self.db

    async def reset_database(self) -> float:
        """Restore the seed users."""
        self.db.reset()
        return 1.0


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> tuple[TestClient, _UsersDb]:
    """Create a TestClient over labs_dir and return it with its in-memory database."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    manager = _StubDatabaseManager(settings)
    return TestClient(create_app(settings=settings, db_manager=manager)), manager.db


def _update(client: TestClient, mode: str, body: dict[str, Any], actor: str) -> dict[str, Any]:
    """POST update_profile as the given persona and return the JSON response."""
    resp = client.post(
        f"{_LAB}/{mode}/update_profile",
        json=body,
        headers={"X-VVWA-Actor": actor},
    )
    assert resp.status_code == 200
    result: dict[str, Any] = resp.json()
    return result


def test_lab_05_discovery_source_diff_and_zip() -> None:
    """Lab 05 has actors, steps in both modes, a diff on the schema, and no sink pair."""
    client, _ = _make_client()
    labs = client.get("/api/labs").json()["labs"]
    lab = next(item for item in labs if item["id"] == "05-mass-assignment")
    assert lab["actors"] == ["alice", "bob"]
    assert len(lab["verifyTests"]) == 6

    source = client.get(f"{_LAB}/source").json()
    tags = {"require-session", "bind-fields", "check-email", "update-user"}
    assert tags <= set(source["vulnerable"]["steps"]) and tags <= set(source["secure"]["steps"])
    assert "profile-schema" in source["secure"]["steps"]
    assert {"fe-submit-profile", "fe-render-profile"} <= set(source["frontend"]["steps"])
    assert '+    model_config = ConfigDict(extra="forbid")' in source["diff"]
    assert source["frontend_diff"] is None

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_05_vulnerable_writes_role_and_balance() -> None:
    """Vulnerable mode stores role and balance sent next to email; the engine sees the new role."""
    client, db = _make_client()
    body = {"email": "bob@minishop.local", "role": "admin", "balance": 1000, "username": "x"}
    result = _update(client, "vulnerable", body, "bob")
    assert result["meta"]["outcome"] == "exploited"
    assert result["data"]["profile"]["role"] == "admin"
    assert result["data"]["profile"]["balance"] == 1000.0
    assert db.users[1]["username"] == "bob"
    update = next(s for s in result["trace"] if s["tag"] == "update-user")
    assert update["status"] == "danger" and "role: customer -> admin" in update["detail"]

    following = _update(client, "vulnerable", {"email": "bob@minishop.local"}, "bob")
    assert "role=admin" in following["trace"][0]["detail"]


def test_lab_05_secure_rejects_fields_outside_the_schema() -> None:
    """Secure mode forbids extra fields, validates email, and still changes email."""
    client, db = _make_client()
    escalate = _update(client, "secure", {"email": "b@minishop.local", "role": "admin"}, "bob")
    assert escalate["meta"]["outcome"] == "blocked"
    assert escalate["data"]["error"] == "Không được phép cập nhật trường: role."
    assert escalate["data"]["profile"]["email"] == "bob@minishop.local"
    assert escalate["trace"][-1]["tag"] == "profile-schema"

    bad = _update(client, "secure", {"email": "khong-phai-email"}, "alice")
    assert (bad["meta"]["outcome"], bad["data"]["error"]) == ("normal", "Email không hợp lệ.")
    taken = _update(client, "secure", {"email": "bob@minishop.local"}, "alice")
    assert taken["data"]["error"] == "Email bob@minishop.local đã được tài khoản khác sử dụng."

    ok = _update(client, "secure", {"email": "alice.new@minishop.local"}, "alice")
    assert ok["data"]["updated"] is True
    assert db.users[0]["email"] == "alice.new@minishop.local"
    assert db.users[0]["role"] == "customer"


def test_lab_05_load_profile_is_scoped_to_session() -> None:
    """load_profile returns the session user's own profile only."""
    client, _ = _make_client()
    headers = {"X-VVWA-Actor": "alice"}
    profile = client.post(f"{_LAB}/secure/load_profile", json={"id": 3}, headers=headers).json()
    assert profile["data"]["profile"]["username"] == "alice"
    anonymous = client.post(f"{_LAB}/vulnerable/load_profile", json={}).json()
    assert anonymous["data"]["profile"] is None


def test_lab_05_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 3/6 before the fix and 6/6 with the ProfileUpdate schema."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "05-mass-assignment", labs_dir / "05-mass-assignment")
    client, _ = _make_client(labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 3, 6)
    failed = {r["name"] for r in before["results"] if not r["passed"]}
    assert failed == {
        "Không tự nâng role lên admin",
        "Không tự sửa số dư",
        "Email sai định dạng bị từ chối",
    }

    backend = labs_dir / "05-mass-assignment" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True and after["passed_count"] == 6
