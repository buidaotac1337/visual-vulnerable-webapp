"""Integration tests for Lab 02 (02-stored-xss): discovery, sink pair, handlers, verify."""

import copy
import io
import zipfile
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/02-stored-xss"
_PAYLOAD = "<img src=x onerror=alert(1)>"

_SEED: dict[str, list[dict[str, Any]]] = {
    "users": [
        {"id": 2, "username": "alice", "role": "customer"},
        {"id": 3, "username": "bob", "role": "customer"},
    ],
    "products": [
        {"id": 1, "name": "Ban phim co MiniShop K1"},
        {"id": 2, "name": "Chuot khong day Silent M2"},
    ],
    "reviews": [
        {"id": 1, "product_id": 1, "user_id": 2, "rating": 5, "content": "Go rat suong tay!"},
        {"id": 2, "product_id": 2, "user_id": 3, "rating": 4, "content": "Chuot nhe."},
    ],
}


class _ReviewsDb:
    """In-memory MiniShop subset answering the queries issued by Lab 02 handlers."""

    def __init__(self) -> None:
        self.tables = copy.deepcopy(_SEED)

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Resolve the engine's actor lookup by username."""
        assert "FROM users WHERE username = $1" in query
        return next((u for u in self.tables["users"] if u["username"] == args[0]), None)

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return the product list or the joined review list of one product."""
        if query.startswith("SELECT id, name FROM products"):
            return list(self.tables["products"])
        assert "JOIN users" in query
        names = {u["id"]: u["username"] for u in self.tables["users"]}
        return [
            {
                "id": r["id"],
                "rating": r["rating"],
                "content": r["content"],
                "username": names[r["user_id"]],
            }
            for r in self.tables["reviews"]
            if r["product_id"] == args[0]
        ]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Insert a review row and return its id, enforcing the rating CHECK like PostgreSQL."""
        assert query.startswith("INSERT INTO reviews")
        product_id, user_id, rating, content = args
        assert isinstance(rating, int) and 1 <= rating <= 5
        new_id = max(r["id"] for r in self.tables["reviews"]) + 1
        self.tables["reviews"].append(
            {
                "id": new_id,
                "product_id": product_id,
                "user_id": user_id,
                "rating": rating,
                "content": content,
            },
        )
        return new_id

    async def execute(self, query: str, *args: object) -> str:
        """Unused by Lab 02."""
        _ = (query, args)
        return "OK"


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double sharing one _ReviewsDb; reset restores the seed."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.db = _ReviewsDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the shared in-memory database."""
        return self.db

    async def reset_database(self) -> float:
        """Restore seed rows in place (the verifier keeps its db handle across resets)."""
        self.db.tables = copy.deepcopy(_SEED)
        return 1.0


def _make_client() -> TestClient:
    """Create a TestClient over the real labs/ directory and the in-memory database."""
    settings = Settings(labs_dir=_REPO_LABS_DIR, environment="test")
    return TestClient(create_app(settings=settings, db_manager=_StubDatabaseManager(settings)))


def _post(client: TestClient, mode: str, body: dict[str, Any], actor: str | None) -> dict[str, Any]:
    """Call post_review as the given persona."""
    headers = {"X-VVWA-Actor": actor} if actor else {}
    resp = client.post(f"{_LAB}/{mode}/post_review", json=body, headers=headers)
    assert resp.status_code == 200
    result: dict[str, Any] = resp.json()
    return result


def test_lab_02_discovery_sink_pair_source_and_zip() -> None:
    """Lab 02 exposes actors, both verify layers, the frontend sink pair, and a full ZIP."""
    client = _make_client()
    lab = next(
        item for item in client.get("/api/labs").json()["labs"] if item["id"] == "02-stored-xss"
    )
    assert lab["actors"] == ["alice", "bob"]
    layers = [test.get("layer", "backend") for test in lab["verifyTests"]]
    assert layers.count("backend") == 4 and layers.count("frontend") == 6

    source = client.get(f"{_LAB}/source").json()
    backend_tags = {"load-reviews", "return-reviews", "require-session", "validate-review"}
    backend_tags |= {"insert-review", "reload-reviews"}
    for side in ("vulnerable", "secure"):
        assert backend_tags <= set(source[side]["steps"])
        assert "fe-render-review" in source[f"frontend_{side}"]["steps"]
    assert {"fe-load-reviews", "fe-submit-review"} <= set(source["frontend"]["steps"])
    removed = [line for line in source["frontend_diff"].splitlines() if line.startswith("-")]
    assert any("dangerouslySetInnerHTML" in line for line in removed)
    assert "dangerouslySetInnerHTML" not in source["frontend"]["code"]

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert {"vulnerable.tsx", "secure.tsx", "frontend.diff.patch"} <= set(archive.namelist())


def test_lab_02_post_review_requires_session_validates_and_stores_verbatim() -> None:
    """Anonymous and invalid reviews are rejected; valid HTML content is stored unchanged."""
    client = _make_client()
    body = {"product_id": 1, "rating": 1, "content": _PAYLOAD}

    anonymous = _post(client, "vulnerable", body, None)
    assert anonymous["data"]["saved"] is False
    assert [s["tag"] for s in anonymous["trace"]] == ["engine-session", "require-session"]

    bad_rating = _post(client, "secure", {**body, "rating": 9}, "alice")
    assert bad_rating["data"]["saved"] is False
    assert "1 đến 5" in bad_rating["data"]["error"]

    saved = _post(client, "vulnerable", body, "bob")
    assert saved["data"]["saved"] is True
    assert saved["data"]["review"] == {"id": 3, "username": "bob", "rating": 1, "content": _PAYLOAD}
    assert "bob (id=3" in saved["trace"][0]["detail"]
    insert = next(s for s in saved["trace"] if s["tag"] == "insert-review")
    assert insert["status"] == "warning"
    assert saved["meta"]["outcome"] == "exploited"


def test_lab_02_list_reviews_outcome_depends_on_stored_markup_and_mode() -> None:
    """Seed reviews are normal; a stored payload is exploited (vulnerable) / blocked (secure)."""
    client = _make_client()
    clean = client.post(f"{_LAB}/vulnerable/list_reviews", json={"product_id": 1}).json()
    assert clean["meta"]["outcome"] == "normal"
    assert clean["data"]["count"] == 1
    assert [p["id"] for p in clean["data"]["products"]] == [1, 2]

    _post(client, "secure", {"product_id": 1, "rating": 2, "content": _PAYLOAD}, "bob")
    vuln = client.post(f"{_LAB}/vulnerable/list_reviews", json={"product_id": "1"}).json()
    sec = client.post(f"{_LAB}/secure/list_reviews", json={"product_id": 1}).json()
    assert vuln["meta"]["outcome"] == "exploited"
    assert vuln["trace"][-1]["status"] == "warning"
    assert sec["meta"]["outcome"] == "blocked"
    assert sec["data"]["reviews"][-1]["content"] == _PAYLOAD


def test_lab_02_backend_verify_passes_and_skips_frontend_tests() -> None:
    """The backend half is already correct, so only the 4 backend tests run and all pass."""
    report = _make_client().post(f"{_LAB}/verify?reset_db=true").json()
    assert report["total"] == 4
    assert report["passed"] is True, [r for r in report["results"] if not r["passed"]]
