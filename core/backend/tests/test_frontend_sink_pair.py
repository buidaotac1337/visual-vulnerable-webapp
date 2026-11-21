"""Tests for ADR-0006 PR 2a: expect operators, layered verifyTests, frontend sink pair."""

import io
import json
import logging
import zipfile
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import create_app
from app.core import InvalidExpectationError, Settings
from app.db import DatabaseManager, LabDatabaseProtocol
from app.schemas import BackendVerifyTest, FrontendVerifyTest, LabMetadata
from app.services import matches_expected

_LAB_ID = "00-demo-xss"

# Mirrored in core/frontend/src/__tests__/expectMatcher.test.ts — keep both lists identical.
MATCHER_CASES: list[tuple[Any, Any, bool]] = [
    (True, True, True),
    (True, 1, False),
    (False, 0, False),
    (1, 1, True),
    ("a", "a", True),
    (None, None, True),
    ({"a": 1}, {"a": 1, "b": 2}, True),
    ({"a": 1}, {"b": 1}, False),
    ({"a": {"b": True}}, {"a": {"b": True, "c": 0}}, True),
    ([1, 2], [1, 2], True),
    ([1], [1, 2], False),
    ({"$contains": "<img"}, "&lt;img <img", True),
    ({"$contains": "<img"}, "&lt;img", False),
    ({"$notContains": "<img"}, "&lt;img src=x&gt;", True),
    ({"$notContains": "<img"}, "<img src=x>", False),
    ({"$contains": "a", "$notContains": "b"}, "abc", False),
    ({"$contains": "x"}, 5, False),
    ({"$notContains": "x"}, None, False),
    ({"text": {"$contains": "hi"}}, {"text": "oh hi"}, True),
    ({}, {"anything": 1}, True),
]

_VULN_HANDLER = """
async def render_review(payload, db):
    content = payload.get("content", "")
    return {"data": {"html": f"<p>{content}</p>"}, "meta": {"outcome": "normal"}, "trace": []}
"""


class _NoDb:
    """Lab DB stub; the demo handlers never query it."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        """Return no row."""
        _ = (query, args)
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        """Return no rows."""
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        """Return None."""
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        """Return a synthetic status tag."""
        _ = (query, args)
        return "OK"


class _Manager(DatabaseManager):
    """DatabaseManager double serving _NoDb."""

    async def get_lab_db(self) -> LabDatabaseProtocol:
        """Return the stub DB."""
        return _NoDb()


def _meta(verify_tests: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a minimal meta.json dict with the given verifyTests."""
    return {
        "id": _LAB_ID,
        "title": "XSS demo",
        "category": "XSS",
        "difficulty": "Co ban",
        "summary": "Demo",
        "safetyPattern": "Render as text",
        "verifyTests": verify_tests,
    }


_FRONTEND_TEST = {
    "name": "fe",
    "layer": "frontend",
    "component": "ReviewContent",
    "props": {"content": "<img src=x onerror=alert(1)>"},
    "expect": {"activeContent": False},
}


def _write_lab(
    tmp_path: Path, verify_tests: list[dict[str, Any]], *, sinks: tuple[bool, bool]
) -> Path:
    """Create a synthetic lab with optional frontend sink files and return labs_dir."""
    lab_dir = tmp_path / "labs" / _LAB_ID
    (lab_dir / "backend").mkdir(parents=True)
    (lab_dir / "frontend").mkdir()
    (lab_dir / "meta.json").write_text(json.dumps(_meta(verify_tests)), encoding="utf-8")
    for mode in ("vulnerable", "secure"):
        (lab_dir / "backend" / f"{mode}.py").write_text(_VULN_HANDLER, encoding="utf-8")
    sink_bodies = {
        "vulnerable.tsx": "// @snippet:start\n// @step:render-review\n"
        "export const sink = 'dangerouslySetInnerHTML';\n// @snippet:end\n",
        "secure.tsx": "// @snippet:start\n// @step:render-review\n"
        "export const sink = 'text';\n// @snippet:end\n",
    }
    for (name, body), present in zip(sink_bodies.items(), sinks, strict=True):
        if present:
            (lab_dir / "frontend" / name).write_text(body, encoding="utf-8")
    return tmp_path / "labs"


def _client(labs_dir: Path) -> TestClient:
    """Return a TestClient bound to labs_dir with a stub DB."""
    settings = Settings(labs_dir=labs_dir, environment="test")
    return TestClient(create_app(settings=settings, db_manager=_Manager(settings)))


@pytest.mark.parametrize(("expected", "actual", "result"), MATCHER_CASES)
def test_matcher_cases(expected: Any, actual: Any, result: bool) -> None:  # noqa: ANN401
    """Shared matcher semantics: strict bools, subset dicts, string operators."""
    assert matches_expected(expected, actual) is result


@pytest.mark.parametrize(
    "expected",
    [{"$regex": "x"}, {"$contains": 1}, {"$notContains": "zzz", "$bogus": "x"}],
)
def test_matcher_rejects_unknown_or_malformed_operators(expected: dict[str, Any]) -> None:
    """Unknown operators and non-string operands raise, even after an earlier miss."""
    with pytest.raises(InvalidExpectationError):
        matches_expected(expected, "zzz")


def test_verify_layer_discriminator_defaults_to_backend() -> None:
    """Missing layer means backend; frontend needs a PascalCase component; bad layers fail."""
    backend = {"name": "b", "action": "render_review", "input": {}, "expect": {}}
    meta = LabMetadata.model_validate(_meta([backend, _FRONTEND_TEST]))
    assert isinstance(meta.verify_tests[0], BackendVerifyTest)
    assert isinstance(meta.verify_tests[1], FrontendVerifyTest)
    with pytest.raises(ValidationError):
        LabMetadata.model_validate(_meta([{**_FRONTEND_TEST, "component": "reviewContent"}]))
    with pytest.raises(ValidationError):
        LabMetadata.model_validate(_meta([{**backend, "layer": "database"}]))


def test_backend_verify_uses_operators_and_skips_frontend_tests(tmp_path: Path) -> None:
    """POST /verify grades backend tests only; operator errors become failed results."""
    tests = [
        {
            "name": "keeps text",
            "action": "render_review",
            "input": {"content": "hi"},
            "expect": {"html": {"$contains": "hi"}},
        },
        {
            "name": "blocks tag",
            "action": "render_review",
            "input": {"content": "<b>"},
            "expect": {"html": {"$notContains": "<b>"}},
        },
        {
            "name": "typo",
            "action": "render_review",
            "input": {},
            "expect": {"html": {"$contain": "x"}},
        },
        _FRONTEND_TEST,
    ]
    client = _client(_write_lab(tmp_path, tests, sinks=(True, True)))
    labs = client.get("/api/labs").json()["labs"]
    assert [t["layer"] for t in labs[0]["verifyTests"]] == [
        "backend",
        "backend",
        "backend",
        "frontend",
    ]

    report = client.post(f"/api/labs/{_LAB_ID}/verify").json()
    assert report["total"] == 3
    assert [r["passed"] for r in report["results"]] == [True, False, False]
    assert "$contain" in report["results"][2]["error"]


def test_source_and_zip_include_frontend_sink_pair(tmp_path: Path) -> None:
    """A complete pair adds parsed files, a frontend diff, and three ZIP entries."""
    client = _client(_write_lab(tmp_path, [], sinks=(True, True)))
    source = client.get(f"/api/labs/{_LAB_ID}/source").json()
    assert source["frontend_vulnerable"]["steps"] == {"render-review": 1}
    assert "dangerouslySetInnerHTML" in source["frontend_vulnerable"]["code"]
    assert source["frontend_diff"].startswith("--- vulnerable.tsx\n+++ secure.tsx\n")

    archive = zipfile.ZipFile(io.BytesIO(client.get(f"/api/labs/{_LAB_ID}/download").content))
    names = set(archive.namelist())
    assert {"vulnerable.tsx", "secure.tsx", "frontend.diff.patch"} <= names


def test_partial_sink_pair_is_ignored_with_warning(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Only vulnerable.tsx present: source/zip omit frontend sinks and discovery warns."""
    client = _client(_write_lab(tmp_path, [_FRONTEND_TEST], sinks=(True, False)))
    with caplog.at_level(logging.WARNING):
        assert [lab["id"] for lab in client.get("/api/labs").json()["labs"]] == [_LAB_ID]
    assert "only one of frontend/vulnerable.tsx" in caplog.text
    assert "no complete frontend sink pair" in caplog.text

    source = client.get(f"/api/labs/{_LAB_ID}/source").json()
    assert source["frontend_vulnerable"] is None
    assert source["frontend_diff"] is None
    archive = zipfile.ZipFile(io.BytesIO(client.get(f"/api/labs/{_LAB_ID}/download").content))
    assert "vulnerable.tsx" not in archive.namelist()
