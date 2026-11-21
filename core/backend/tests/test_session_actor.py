"""Tests for the ADR-0005 session actor: header parsing, ctx injection, trace, verify."""

import json
from contextlib import AbstractAsyncContextManager, nullcontext
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import create_app
from app.core import DatabaseUnavailableError, InvalidActorError, Settings
from app.db import DatabaseManager, LabDatabaseProtocol
from app.schemas import LabMetadata
from app.services import resolve_lab_context

_LAB_ID = "00-demo-actor"

_HANDLERS = """
async def whoami(payload, db, ctx):
    actor = ctx.actor
    return {
        "data": {"actor": actor.username if actor else None, "role": actor.role if actor else None},
        "meta": {"outcome": "normal"},
        "trace": [{"layer": "backend", "tag": "read-actor", "status": "info",
                   "title": "Read ctx", "detail": str(payload)}],
    }


async def plain(payload, db):
    return {"data": {"ok": True}, "meta": {"outcome": "normal"}, "trace": []}


async def kw_only(payload, db, *, ctx):
    return {"data": {"actor": ctx.actor.username if ctx.actor else None},
            "meta": {"outcome": "normal"}, "trace": []}


async def var_kw(payload, db, **ctx):
    return {"data": {"extra": sorted(ctx)}, "meta": {"outcome": "normal"}, "trace": []}


async def spoof_engine(payload, db):
    return {"data": {}, "meta": {"outcome": "normal"},
            "trace": [{"layer": "backend", "tag": "engine-session", "status": "safe",
                       "title": "Fake", "detail": "forged"}]}
"""


class _UsersDb:
    """Fake lab DB holding a mutable users table and counting actor lookups."""

    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {
            "alice": {"id": 2, "username": "alice", "role": "customer"},
            "bob": {"id": 3, "username": "bob", "role": "customer"},
        }
        self.lookups = 0

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Answer only the parameterized actor lookup."""
        assert "$1" in query
        self.lookups += 1
        return self.users.get(str(args[0]))

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return no rows for unused stub method."""
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Return None for unused stub method."""
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        """Return a synthetic status tag."""
        _ = (query, args)
        return "OK"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        """Return a no-op async transaction context for protocol compliance."""
        return nullcontext(self)


class _Manager(DatabaseManager):
    """DatabaseManager double serving one shared _UsersDb (or failing when offline)."""

    def __init__(self, settings: Settings, db: _UsersDb, *, offline: bool = False) -> None:
        super().__init__(settings)
        self.db = db
        self._offline = offline

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the shared fake DB or simulate PostgreSQL being down."""
        if self._offline:
            msg = "DB offline"
            raise DatabaseUnavailableError(msg)
        return self.db


def _meta(**overrides: Any) -> dict[str, Any]:  # noqa: ANN401
    """Build a minimal valid meta.json dict with optional overrides."""
    base: dict[str, Any] = {
        "id": _LAB_ID,
        "title": "Actor demo",
        "category": "Access Control",
        "difficulty": "Co ban",
        "summary": "Demo",
        "safetyPattern": "Use ctx.actor",
        "actors": ["alice", "bob"],
        "samplePayloads": [],
        "verifyTests": [
            {
                "name": "bob session",
                "action": "whoami",
                "input": {},
                "actor": "bob",
                "expect": {"actor": "bob"},
            },
            {"name": "anonymous", "action": "whoami", "input": {}, "expect": {"actor": None}},
        ],
    }
    base.update(overrides)
    return base


def _client(tmp_path: Path, *, offline: bool = False) -> tuple[TestClient, _UsersDb]:
    """Write the synthetic lab and return a TestClient plus its fake DB."""
    lab_dir = tmp_path / "labs" / _LAB_ID
    (lab_dir / "backend").mkdir(parents=True)
    (lab_dir / "meta.json").write_text(json.dumps(_meta()), encoding="utf-8")
    for mode in ("vulnerable", "secure"):
        (lab_dir / "backend" / f"{mode}.py").write_text(_HANDLERS, encoding="utf-8")
    settings = Settings(labs_dir=tmp_path / "labs", environment="test")
    db = _UsersDb()
    return TestClient(
        create_app(settings=settings, db_manager=_Manager(settings, db, offline=offline))
    ), db


async def test_resolve_lab_context_anonymous_known_unknown_and_live_role() -> None:
    """Missing/blank header is anonymous; bad or unknown names raise; role is read live."""
    db = _UsersDb()
    assert (await resolve_lab_context(db, None)).actor is None
    assert (await resolve_lab_context(db, "  ")).actor is None
    assert db.lookups == 0
    with pytest.raises(InvalidActorError):
        await resolve_lab_context(db, "Alice")
    with pytest.raises(InvalidActorError):
        await resolve_lab_context(db, "mallory")
    db.users["alice"]["role"] = "admin"
    ctx = await resolve_lab_context(db, "alice")
    assert ctx.actor is not None
    assert (ctx.actor.id, ctx.actor.role) == (2, "admin")


def test_ctx_handler_gets_header_actor_and_engine_session_step(tmp_path: Path) -> None:
    """ctx-aware handlers receive the header persona; the engine step comes first."""
    client, _db = _client(tmp_path)
    url = f"/api/labs/{_LAB_ID}/vulnerable/whoami"

    resp = client.post(url, json={"user_id": 1}, headers={"X-VVWA-Actor": "alice"})
    body = resp.json()
    assert resp.status_code == 200
    assert body["data"] == {"actor": "alice", "role": "customer"}
    assert [step["tag"] for step in body["trace"]] == ["engine-session", "read-actor"]
    assert [step["step"] for step in body["trace"]] == [1, 2]
    assert "alice (id=2" in body["trace"][0]["detail"]

    anon = client.post(url, json={}).json()
    assert anon["data"]["actor"] is None
    assert anon["trace"][0]["detail"].startswith("Ẩn danh")


def test_plain_handler_ignores_header_and_skips_lookup(tmp_path: Path) -> None:
    """Handlers without ctx (like Lab 01) never trigger an actor lookup or engine step."""
    client, db = _client(tmp_path)
    resp = client.post(
        f"/api/labs/{_LAB_ID}/secure/plain", json={}, headers={"X-VVWA-Actor": "mallory"}
    )
    assert resp.status_code == 200
    assert resp.json()["trace"] == []
    assert db.lookups == 0


def test_invalid_actor_header_returns_400_even_when_db_offline(tmp_path: Path) -> None:
    """Malformed headers fail before DB access; unknown personas fail with 400."""
    offline, _ = _client(tmp_path / "offline", offline=True)
    url = f"/api/labs/{_LAB_ID}/vulnerable/whoami"
    assert offline.post(url, json={}, headers={"X-VVWA-Actor": "../admin"}).status_code == 400

    client, _ = _client(tmp_path / "online")
    unknown = client.post(url, json={}, headers={"X-VVWA-Actor": "mallory"})
    assert unknown.status_code == 400
    assert "mallory" in unknown.json()["detail"]


def test_lab_cannot_forge_engine_tags(tmp_path: Path) -> None:
    """A lab trace using the reserved engine- prefix becomes a runtime-error envelope."""
    client, _ = _client(tmp_path)
    body = client.post(f"/api/labs/{_LAB_ID}/vulnerable/spoof_engine", json={}).json()
    assert body["ok"] is False
    assert body["meta"]["outcome"] == "error"
    assert body["trace"][0]["tag"] == "runtime-error"


def test_verify_runs_tests_under_declared_actor(tmp_path: Path) -> None:
    """verifyTests[].actor builds the session context; tests without actor stay anonymous."""
    client, _ = _client(tmp_path)
    report = client.post(f"/api/labs/{_LAB_ID}/verify").json()
    assert report["passed"] is True
    assert report["passed_count"] == 2


def test_verify_reports_deleted_actor_as_failed_test(tmp_path: Path) -> None:
    """A persona removed from the DB fails its verify test with an error instead of a 400."""
    client, db = _client(tmp_path)
    del db.users["bob"]
    resp = client.post(f"/api/labs/{_LAB_ID}/verify")
    assert resp.status_code == 200
    report = resp.json()
    assert report["passed"] is False
    bob_result = report["results"][0]
    assert bob_result["passed"] is False
    assert "bob" in bob_result["error"]
    assert report["results"][1]["passed"] is True


def test_ctx_injection_respects_parameter_kind(tmp_path: Path) -> None:
    """Keyword-only ctx is injected; **ctx is not treated as an opt-in and skips the lookup."""
    client, db = _client(tmp_path)
    headers = {"X-VVWA-Actor": "alice"}
    kw_only = client.post(f"/api/labs/{_LAB_ID}/vulnerable/kw_only", json={}, headers=headers)
    assert kw_only.json()["data"] == {"actor": "alice"}
    assert db.lookups == 1

    var_kw = client.post(f"/api/labs/{_LAB_ID}/vulnerable/var_kw", json={}, headers=headers)
    body = var_kw.json()
    assert body["ok"] is True
    assert body["data"] == {"extra": []}
    assert body["trace"] == []
    assert db.lookups == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"actors": ["Alice"]},
        {"actors": ["alice", "alice"]},
        {"actors": ["alice"]},
        {
            "verifyTests": [
                {"name": "t", "action": "whoami", "input": {}, "expect": {}, "actor": ""}
            ]
        },
        {"samplePayloads": [{"label": "x", "description": "y", "data": {}, "actor": "eve"}]},
    ],
)
def test_metadata_rejects_bad_or_undeclared_actors(overrides: dict[str, Any]) -> None:
    """Actor names must be safe and unique, and every reference must be declared."""
    with pytest.raises(ValidationError):
        LabMetadata.model_validate(_meta(**overrides))


def test_metadata_without_actors_stays_valid() -> None:
    """Labs that never mention actors (Lab 01) keep validating unchanged."""
    meta = LabMetadata.model_validate(_meta(actors=[], verifyTests=[]))
    assert meta.actors == []
