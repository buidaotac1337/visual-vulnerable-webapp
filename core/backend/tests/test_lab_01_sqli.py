"""Integration tests for Lab 01 (01-sql-injection) discovery, execution, and verify."""

import io
import shutil
import zipfile
from contextlib import AbstractAsyncContextManager, nullcontext
from pathlib import Path
from typing import Any

import asyncpg
from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"

_USERS: list[dict[str, Any]] = [
    {
        "id": 1,
        "username": "admin",
        "email": "admin@minishop.local",
        "password_hash": "admin_secret_2026",
        "role": "admin",
        "balance": 9999.0,
    },
    {
        "id": 2,
        "username": "alice",
        "email": "alice@minishop.local",
        "password_hash": "password123",
        "role": "customer",
        "balance": 500.0,
    },
]

_PRODUCTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "Ban phim co MiniShop K1",
        "description": "Switch linear em ai.",
        "price": 89.0,
        "stock": 25,
    },
    {
        "id": 2,
        "name": "Chuot khong day Silent M2",
        "description": "Pin sac USB-C.",
        "price": 45.0,
        "stock": 40,
    },
]


class _SqlInjectionStubDb:
    """In-memory LabDatabaseProtocol stub simulating SQLi vs parameterized behavior."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Simulate login SQLi bypass (username or password), syntax error, and $1/$2 lookup."""
        if args:
            username, password = str(args[0]), str(args[1])
            for user in _USERS:
                if user["username"] == username and user["password_hash"] == password:
                    return {k: v for k, v in user.items() if k != "password_hash"}
            return None
        if "BROKEN_SYNTAX'" in query:
            raise asyncpg.PostgresSyntaxError("syntax error at or near 'BROKEN_SYNTAX'")
        if "' OR 1=1--" in query or "' OR '1'='1" in query:
            return {k: v for k, v in _USERS[0].items() if k != "password_hash"}
        for user in _USERS:
            if (
                f"username = '{user['username']}'" in query
                and f"password_hash = '{user['password_hash']}'" in query
            ):
                return {k: v for k, v in user.items() if k != "password_hash"}
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Simulate product search UNION dump, apostrophe syntax error, vs parameterized ILIKE."""
        if args:
            needle = str(args[0]).strip("%").lower()
            return [p for p in _PRODUCTS if needle in str(p["name"]).lower()]
        if query == "SELECT id, name, description, price, stock FROM products ORDER BY id":
            return [dict(p) for p in _PRODUCTS]
        if "DISGUISED" in query:
            # UNION row that reuses a real product's id and name but carries a stolen hash.
            return [{**_PRODUCTS[0], "description": "admin_secret_2026", "stock": 0}]
        if "UNION SELECT" in query.upper():
            real = [dict(_PRODUCTS[0])] if "ILIKE '%Ban phim%' UNION" in query else []
            return real + [
                {
                    "id": u["id"],
                    "name": u["username"],
                    "description": f"{u['email']}:{u['password_hash']}",
                    "price": u["balance"],
                    "stock": 0,
                }
                for u in _USERS
            ]
        if "O'Reilly" in query:
            raise asyncpg.PostgresSyntaxError("syntax error at or near 'Reilly'")
        lowered = query.lower()
        return [p for p in _PRODUCTS if "ban phim" in lowered and "ban phim" in p["name"].lower()]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Return None for unused protocol method."""
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        """Return synthetic command status."""
        _ = (query, args)
        return "OK"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        """Return a no-op async transaction context for protocol compliance."""
        return nullcontext(self)


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager test double backed by _SqlInjectionStubDb."""

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return in-memory SQLi stub database."""
        return _SqlInjectionStubDb()

    async def reset_database(self) -> float:
        """Return synthetic reset duration."""
        return 1.0


def _make_client(labs_dir: Path = _REPO_LABS_DIR) -> TestClient:
    """Create a FastAPI TestClient pointing at labs_dir with _StubDatabaseManager."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    return TestClient(create_app(settings=settings, db_manager=_StubDatabaseManager(settings)))


def test_lab_01_discovery_source_steps_and_zip_download() -> None:
    """Verify Lab 01 metadata, backend/frontend @step mappings, diff, and ZIP bundle."""
    client = _make_client()

    labs_resp = client.get("/api/labs")
    assert labs_resp.status_code == 200
    labs = labs_resp.json()["labs"]
    lab_01 = next(item for item in labs if item["id"] == "01-sql-injection")
    assert len(lab_01["samplePayloads"]) == 4
    assert len(lab_01["verifyTests"]) == 6

    source_resp = client.get("/api/labs/01-sql-injection/source")
    assert source_resp.status_code == 200
    source = source_resp.json()
    for tag in ("build-login-query", "exec-login-query", "build-search-query", "exec-search-query"):
        assert tag in source["vulnerable"]["steps"]
        assert tag in source["secure"]["steps"]
    assert source["frontend"] is not None
    assert "fe-login-submit" in source["frontend"]["steps"]
    assert "fe-search-submit" in source["frontend"]["steps"]
    assert source["diff"].strip() != ""

    zip_resp = client.get("/api/labs/01-sql-injection/download")
    assert zip_resp.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_01_login_normal_exploit_password_sqli_and_secure() -> None:
    """Verify valid login, wrong password, username/password SQLi, and SQL syntax error."""
    client = _make_client()

    valid = client.post(
        "/api/labs/01-sql-injection/vulnerable/login",
        json={"username": "alice", "password": "password123"},
    ).json()
    assert valid["meta"]["outcome"] == "normal"
    assert valid["data"]["logged_in"] is True

    wrong_pw = client.post(
        "/api/labs/01-sql-injection/secure/login",
        json={"username": "alice", "password": "wrong"},
    ).json()
    assert wrong_pw["meta"]["outcome"] == "normal"
    assert wrong_pw["data"]["logged_in"] is False

    pw_sqli = client.post(
        "/api/labs/01-sql-injection/vulnerable/login",
        json={"username": "admin", "password": "' OR '1'='1"},
    ).json()
    assert pw_sqli["meta"]["outcome"] == "exploited"
    assert pw_sqli["trace"][0]["status"] == "danger"

    sec_pw_sqli = client.post(
        "/api/labs/01-sql-injection/secure/login",
        json={"username": "admin", "password": "' OR '1'='1"},
    ).json()
    assert sec_pw_sqli["meta"]["outcome"] == "blocked"
    assert sec_pw_sqli["data"]["logged_in"] is False

    err_login = client.post(
        "/api/labs/01-sql-injection/vulnerable/login",
        json={"username": "BROKEN_SYNTAX'", "password": "x"},
    ).json()
    assert err_login["meta"]["outcome"] == "error"
    assert "sql_error" in err_login["data"]


def test_lab_01_search_union_dump_apostrophe_error_and_secure() -> None:
    """Verify UNION dump exploit, apostrophe SQL error, and parameterized ILIKE defense."""
    client = _make_client()
    union_payload = (
        "' AND 1=0 UNION SELECT id, username, "
        "email || ':' || password_hash, balance, 0 FROM users--"
    )

    vuln_search = client.post(
        "/api/labs/01-sql-injection/vulnerable/search_products",
        json={"keyword": union_payload},
    ).json()
    assert vuln_search["meta"]["outcome"] == "exploited"
    assert vuln_search["data"]["count"] == 2
    assert vuln_search["data"]["leaked_rows"] == [0, 1]

    def vuln(keyword: str) -> dict[str, Any]:
        result: dict[str, Any] = client.post(
            "/api/labs/01-sql-injection/vulnerable/search_products",
            json={"keyword": keyword},
        ).json()
        return result

    normal = vuln("Ban phim")
    assert normal["meta"]["outcome"] == "normal"
    assert normal["data"]["leaked_rows"] == []
    # Real product first, leaked users after: only the leaked indexes are flagged.
    mixed = vuln("Ban phim%' UNION SELECT id, username, email, balance, 0 FROM users--")
    assert mixed["data"]["count"] == 3 and mixed["data"]["leaked_rows"] == [1, 2]
    # A UNION row disguised with a real id and name is still caught by its other columns.
    disguised = vuln("' AND 1=0 UNION SELECT 1, 'x', password_hash, 0, 0 FROM users-- DISGUISED")
    assert disguised["data"]["leaked_rows"] == [0]

    sec_search = client.post(
        "/api/labs/01-sql-injection/secure/search_products",
        json={"keyword": union_payload},
    ).json()
    assert sec_search["meta"]["outcome"] == "blocked"
    assert sec_search["data"]["count"] == 0
    assert sec_search["data"]["leaked_rows"] == []

    err_search = client.post(
        "/api/labs/01-sql-injection/vulnerable/search_products",
        json={"keyword": "O'Reilly"},
    ).json()
    assert err_search["meta"]["outcome"] == "error"
    assert "sql_error" in err_search["data"]
    assert err_search["data"]["leaked_rows"] == []


def test_lab_01_verify_blocks_sql_errors_and_passes_when_patched(tmp_path: Path) -> None:
    """Confirm Test My Fix fails unpatched & SQL-error cases (2/6) and passes patched (6/6)."""
    copied_labs = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "01-sql-injection", copied_labs / "01-sql-injection")
    client = _make_client(copied_labs)

    before_fix = client.post("/api/labs/01-sql-injection/verify?reset_db=true").json()
    assert before_fix["passed"] is False
    assert before_fix["passed_count"] == 2
    assert before_fix["total"] == 6
    # Specifically verify O'Reilly PostgresSyntaxError is marked FAIL with error text.
    oreilly = next(r for r in before_fix["results"] if "O'Reilly" in r["name"])
    assert oreilly["passed"] is False
    assert oreilly["error"] is not None

    backend_dir = copied_labs / "01-sql-injection" / "backend"
    (backend_dir / "vulnerable.py").write_text(
        (backend_dir / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after_fix = client.post("/api/labs/01-sql-injection/verify?reset_db=true").json()
    assert after_fix["passed"] is True
    assert after_fix["passed_count"] == 6
