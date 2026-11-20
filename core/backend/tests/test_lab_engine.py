"""Unit tests for lab discovery, hot-reload, Pydantic/dataclass labs, and verify."""

import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import DatabaseUnavailableError, Settings
from app.db import DatabaseManager, LabDatabaseProtocol


class _FakeLabDb:
    """In-memory LabDatabaseProtocol stub simulating vulnerable vs parameterized SQL."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Simulate SQLi bypass on raw string concat vs strict matching on $1/$2."""
        if args:
            if args == ("alice", "password123"):
                return {"id": 2, "username": "alice", "role": "customer", "balance": 500.0}
            return None
        if "' OR 1=1--" in query:
            return {"id": 1, "username": "admin", "role": "admin", "balance": 9999.0}
        if "username = 'alice'" in query and "password_hash = 'password123'" in query:
            return {"id": 2, "username": "alice", "role": "customer", "balance": 500.0}
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return empty row list for unused stub method."""
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Return None for unused stub method."""
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        """Return synthetic command status tag."""
        _ = (query, args)
        return "OK"


class _FakeDatabaseManager(DatabaseManager):
    """DatabaseManager test double returning _FakeLabDb without touching Postgres."""

    def __init__(self, settings: Settings, *, fail_db: bool = False) -> None:
        super().__init__(settings)
        self.reset_calls = 0
        self._fail_db = fail_db

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return _FakeLabDb or raise DatabaseUnavailableError when configured."""
        if self._fail_db:
            msg = "DB offline"
            raise DatabaseUnavailableError(msg)
        return _FakeLabDb()

    async def reset_database(self) -> float:
        """Record a synthetic reset invocation."""
        self.reset_calls += 1
        return 1.25


def _build_demo_lab(tmp_path: Path) -> Path:
    """Write a complete synthetic lab under tmp_path/labs/00-demo-sqli."""
    labs_dir = tmp_path / "labs"
    lab_dir = labs_dir / "00-demo-sqli"
    (lab_dir / "backend").mkdir(parents=True)
    meta = {
        "id": "00-demo-sqli",
        "title": "SQL Injection Demo",
        "category": "Injection",
        "difficulty": "Co ban",
        "summary": "Demo summary",
        "safetyPattern": "Use parameterized queries.",
        "samplePayloads": [],
        "verifyTests": [
            {
                "name": "Valid user logs in with customer role",
                "action": "login",
                "input": {"username": "alice", "password": "password123"},
                "expect": {"logged_in": True, "user": {"role": "customer"}},
            },
            {
                "name": "SQLi payload blocked",
                "action": "login",
                "input": {"username": "' OR 1=1--", "password": "wrong"},
                "expect": {"logged_in": False},
            },
        ],
    }
    (lab_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    (lab_dir / "README.md").write_text("# Demo\n", encoding="utf-8")
    (lab_dir / "backend" / "vulnerable.py").write_text(
        "async def login(payload, db):\n"
        "    u, p = payload.get('username', ''), payload.get('password', '')\n"
        "    sql = f\"SELECT * FROM users WHERE username = '{u}' AND password_hash = '{p}'\"\n"
        "    row = await db.fetch_one(sql)\n"
        "    return {\n"
        "        'data': {'logged_in': row is not None, 'user': row},\n"
        "        'meta': {\n"
        "            'outcome': 'exploited' if row and row['role'] == 'admin' else 'normal'\n"
        "        },\n"
        "        'trace': [\n"
        "            {'step': 99, 'layer': 'backend', 'tag': 'build-query', 'status': 'danger',\n"
        "             'title': 'f-string', 'detail': sql},\n"
        "        ],\n"
        "    }\n",
        encoding="utf-8",
    )
    (lab_dir / "backend" / "secure.py").write_text(
        "from __future__ import annotations\n"
        "from dataclasses import dataclass\n"
        "from pydantic import BaseModel\n"
        "@dataclass\n"
        "class Creds:\n"
        "    username: str\n"
        "    password: str\n"
        "class Inner(BaseModel):\n"
        "    ok: bool\n"
        "class Outer(BaseModel):\n"
        "    inner: Inner\n"
        "async def login(payload, db):\n"
        "    creds = Creds(payload.get('username', ''), payload.get('password', ''))\n"
        "    _ = Outer(inner=Inner(ok=True))\n"
        "    sql = 'SELECT * FROM users WHERE username = $1 AND password_hash = $2'\n"
        "    row = await db.fetch_one(sql, creds.username, creds.password)\n"
        "    return {\n"
        "        'data': {'logged_in': row is not None, 'user': row},\n"
        "        'meta': {'outcome': 'blocked' if row is None else 'normal'},\n"
        "        'trace': [\n"
        "            {'layer': 'backend', 'tag': 'build-query', 'status': 'safe',\n"
        "             'title': 'Parameterized', 'detail': sql},\n"
        "        ],\n"
        "    }\n",
        encoding="utf-8",
    )
    return labs_dir


def test_lab_lifecycle_nested_pydantic_dataclass_and_isolated_verify(tmp_path: Path) -> None:
    """Verify full lifecycle including @dataclass, nested Pydantic, step order, and verify."""
    labs_dir = _build_demo_lab(tmp_path)
    # Add a second lab with malformed meta.json: GET /api/labs must skip it, not 500.
    broken_dir = labs_dir / "99-broken-meta"
    broken_dir.mkdir(parents=True)
    (broken_dir / "meta.json").write_text("{not valid json", encoding="utf-8")

    settings = Settings(labs_dir=labs_dir, environment="test")
    db_manager = _FakeDatabaseManager(settings)
    client = TestClient(create_app(settings=settings, db_manager=db_manager))

    list_resp = client.get("/api/labs")
    assert list_resp.status_code == 200
    assert [lab["id"] for lab in list_resp.json()["labs"]] == ["00-demo-sqli"]

    # Step number 99 returned by handler is normalized to sequential 1.
    vuln_resp = client.post(
        "/api/labs/00-demo-sqli/vulnerable/login",
        json={"username": "' OR 1=1--", "password": "x"},
    )
    assert vuln_resp.json()["trace"][0]["step"] == 1

    # Secure handler uses from __future__ import annotations + @dataclass + nested BaseModel.
    sec_resp = client.post(
        "/api/labs/00-demo-sqli/secure/login",
        json={"username": "alice", "password": "password123"},
    )
    assert sec_resp.status_code == 200
    assert sec_resp.json()["ok"] is True
    assert sec_resp.json()["data"]["logged_in"] is True

    # Copy secure fix into vulnerable.py -> verify with reset_db=true resets before each test.
    vuln_file = labs_dir / "00-demo-sqli" / "backend" / "vulnerable.py"
    sec_text = (labs_dir / "00-demo-sqli" / "backend" / "secure.py").read_text(encoding="utf-8")
    vuln_file.write_text(sec_text, encoding="utf-8")
    verify_ok = client.post("/api/labs/00-demo-sqli/verify?reset_db=true")
    assert verify_ok.status_code == 200
    assert verify_ok.json()["passed"] is True
    assert db_manager.reset_calls == 2


def test_student_mistakes_return_controlled_errors_not_500_or_false_pass(tmp_path: Path) -> None:
    """Verify malformed trace/meta, int-vs-bool trap, and missing async def are handled safely."""
    labs_dir = _build_demo_lab(tmp_path)
    vuln_file = labs_dir / "00-demo-sqli" / "backend" / "vulnerable.py"
    settings = Settings(labs_dir=labs_dir, environment="test")
    client = TestClient(create_app(settings=settings, db_manager=_FakeDatabaseManager(settings)))

    # 1. Malformed trace / invalid meta.outcome returns HTTP 200 ok=False (never 500).
    vuln_file.write_text(
        "async def login(payload, db):\n"
        "    return {'data': {}, 'meta': {'outcome': 'bogus'}, 'trace': ['not-a-dict']}\n",
        encoding="utf-8",
    )
    bad_schema = client.post("/api/labs/00-demo-sqli/vulnerable/login", json={})
    assert bad_schema.status_code == 200
    assert bad_schema.json()["ok"] is False

    # 2. Returning integer 1/0 must NOT satisfy bool expect True/False.
    vuln_file.write_text(
        "async def login(payload, db):\n"
        "    val = 1 if payload.get('username') == 'alice' else 0\n"
        "    return {'data': {'logged_in': val, 'user': {'role': 'customer'}}, "
        "'meta': {'outcome': 'normal'}, 'trace': []}\n",
        encoding="utf-8",
    )
    bool_trap = client.post("/api/labs/00-demo-sqli/verify")
    assert bool_trap.status_code == 200
    assert bool_trap.json()["passed"] is False
    assert bool_trap.json()["passed_count"] == 0

    # 3. Student accidentally removes 'async' -> verify marks failed with error instead of 404.
    vuln_file.write_text("def login(payload, db):\n    return {}\n", encoding="utf-8")
    sync_err = client.post("/api/labs/00-demo-sqli/verify")
    assert sync_err.status_code == 200
    assert sync_err.json()["passed"] is False
    assert sync_err.json()["results"][0]["error"] is not None


def test_validation_runs_before_db_acquisition(tmp_path: Path) -> None:
    """Confirm invalid lab_id/action/missing lab return 400/404 even when DB is offline."""
    labs_dir = _build_demo_lab(tmp_path)
    settings = Settings(labs_dir=labs_dir, environment="test")
    offline_db = _FakeDatabaseManager(settings, fail_db=True)
    client = TestClient(create_app(settings=settings, db_manager=offline_db))

    assert client.post("/api/labs/00-demo-sqli/vulnerable/_priv", json={}).status_code == 400
    assert client.post("/api/labs/99-unknown/vulnerable/login", json={}).status_code == 404
    assert client.post("/api/labs/99-unknown/verify").status_code == 404
