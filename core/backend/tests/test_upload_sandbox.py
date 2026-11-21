"""Unit tests for Settings.upload_sandbox_dir, sandbox outer jail, and reset lifecycle."""

import json
from contextlib import AbstractAsyncContextManager, nullcontext
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol
from app.services import (
    DEFAULT_WEBROOT_INDEX,
    MAX_SANDBOX_UPLOAD_BYTES,
    ensure_upload_sandbox,
    reset_upload_sandbox,
    write_within_sandbox_jail,
)


class _SandboxResetDb:
    """Minimal LabDatabaseProtocol stub for verify sandbox reset tests."""

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        _ = (query, args)
        return None

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        _ = (query, args)
        return []

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        _ = (query, args)
        return None

    async def execute(self, query: str, *args: object) -> str:
        _ = (query, args)
        return "OK"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        return nullcontext(self)


class _StubManager(DatabaseManager):
    """DatabaseManager stub counting DB resets without needing PostgreSQL."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.db = _SandboxResetDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        return self.db

    async def reset_database(self) -> float:
        return 1.0


def test_settings_upload_sandbox_blank_env_and_overlap_guards(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Blank VVWA_UPLOAD_SANDBOX_DIR falls back to temp dir; overlaps raise ValidationError."""
    monkeypatch.setenv("VVWA_UPLOAD_SANDBOX_DIR", "   ")
    defaulted = Settings(environment="test")
    assert defaulted.upload_sandbox_dir.name == "vvwa-uploads"
    assert defaulted.upload_sandbox_dir != Path().resolve()

    monkeypatch.delenv("VVWA_UPLOAD_SANDBOX_DIR", raising=False)
    labs_dir = tmp_path / "labs"
    labs_dir.mkdir()
    repo_root = Path(__file__).resolve().parents[3]

    for bad_path in (
        labs_dir / "uploads",
        tmp_path,
        repo_root / "tmp-uploads",
        repo_root.parent if repo_root.parent != repo_root else repo_root,
    ):
        if bad_path == repo_root.parent:
            # Only test parent containment when it actually wraps repo_root.
            assert repo_root.is_relative_to(bad_path)
        with pytest.raises(ValidationError):
            Settings(labs_dir=labs_dir, upload_sandbox_dir=bad_path, environment="test")


def test_sandbox_jail_allows_webroot_and_blocks_escapes_and_oversize(tmp_path: Path) -> None:
    """Outer jail allows inner webroot writes but rejects escapes, dirs, and >512 KiB."""
    sandbox = tmp_path / "sandbox"
    webroot, uploads = ensure_upload_sandbox(sandbox)
    assert (webroot / "index.html").read_text(encoding="utf-8") == DEFAULT_WEBROOT_INDEX

    written_ok = write_within_sandbox_jail(sandbox, uploads / "photo.png", b"png-bytes")
    assert written_ok == (uploads / "photo.png").resolve()

    overwritten = write_within_sandbox_jail(sandbox, uploads / "../index.html", b"<h1>Pwn</h1>")
    assert overwritten == (webroot / "index.html").resolve()
    assert (webroot / "index.html").read_text(encoding="utf-8") == "<h1>Pwn</h1>"

    for bad_target in (
        uploads / "../../../../escape.txt",
        tmp_path / "outside.txt",
        uploads / "bad\x00.png",
        uploads,
        webroot,
    ):
        with pytest.raises(ValueError):
            write_within_sandbox_jail(sandbox, bad_target, b"data")

    with pytest.raises(ValueError, match="ceiling"):
        write_within_sandbox_jail(
            sandbox,
            uploads / "huge.bin",
            b"a" * (MAX_SANDBOX_UPLOAD_BYTES + 1),
        )

    reset_upload_sandbox(sandbox)
    assert not (uploads / "photo.png").exists()
    assert (webroot / "index.html").read_text(encoding="utf-8") == DEFAULT_WEBROOT_INDEX


def test_reset_db_and_verify_clean_upload_sandbox(tmp_path: Path) -> None:
    """POST /api/system/reset-db and verify?reset_db=true both clean upload_sandbox_dir."""
    labs_dir = tmp_path / "labs"
    sandbox = tmp_path / "sandbox"
    lab_dir = labs_dir / "00-demo-upload"
    (lab_dir / "backend").mkdir(parents=True)
    meta = {
        "id": "00-demo-upload",
        "title": "Demo Upload",
        "category": "File Handling",
        "difficulty": "Co ban",
        "summary": "Demo",
        "safetyPattern": "Isolate",
        "samplePayloads": [],
        "verifyTests": [
            {
                "name": "Step 1 writes marker",
                "action": "write_marker",
                "input": {"name": "step1.txt"},
                "expect": {"existed_before": False},
            },
            {
                "name": "Step 2 starts with clean sandbox",
                "action": "write_marker",
                "input": {"name": "step1.txt"},
                "expect": {"existed_before": False},
            },
        ],
    }
    (lab_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    (lab_dir / "README.md").write_text("# Demo\n", encoding="utf-8")
    handler_code = (
        "from app.services import ensure_upload_sandbox, write_within_sandbox_jail\n"
        "async def write_marker(payload, db, ctx):\n"
        "    _, uploads = ensure_upload_sandbox(ctx.upload_sandbox_dir)\n"
        "    target = uploads / str(payload['name'])\n"
        "    existed_before = target.exists()\n"
        "    write_within_sandbox_jail(ctx.upload_sandbox_dir, target, b'ok')\n"
        "    return {'data': {'existed_before': existed_before}, "
        "'meta': {'outcome': 'normal'}, 'trace': []}\n"
    )
    (lab_dir / "backend" / "vulnerable.py").write_text(handler_code, encoding="utf-8")
    (lab_dir / "backend" / "secure.py").write_text(handler_code, encoding="utf-8")

    settings = Settings(labs_dir=labs_dir, upload_sandbox_dir=sandbox, environment="test")
    client = TestClient(create_app(settings=settings, db_manager=_StubManager(settings)))

    verify_resp = client.post("/api/labs/00-demo-upload/verify?reset_db=true")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["passed"] is True

    _, uploads = ensure_upload_sandbox(sandbox)
    assert (uploads / "step1.txt").exists()
    reset_resp = client.post("/api/system/reset-db")
    assert reset_resp.status_code == 200
    assert not (uploads / "step1.txt").exists()
