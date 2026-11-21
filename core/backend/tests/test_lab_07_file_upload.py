"""Integration tests for Lab 07 (07-file-upload): MIME spoof, SVG, traversal, jail, verify."""

import base64
import io
import shutil
import zipfile
from contextlib import AbstractAsyncContextManager, nullcontext
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol
from app.services import DEFAULT_WEBROOT_INDEX

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/07-file-upload"
_VALID_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPwd3sKAAJiAXvBJn9xAAAAAElFTkSuQmCC"
)
_SHELL_B64 = base64.b64encode(b"print('RCE')").decode()
_SVG_B64 = base64.b64encode(b'<svg onload="alert(1)"></svg>').decode()
_HTML_B64 = base64.b64encode(b"<h1>Hacked MiniShop</h1>").decode()

_USERS: dict[str, dict[str, Any]] = {
    "admin": {"id": 1, "username": "admin", "role": "admin"},
    "alice": {"id": 2, "username": "alice", "role": "customer"},
}
_SEED_PRODUCTS: list[dict[str, Any]] = [
    {"id": 1, "name": "Ban phim co MiniShop K1", "price": 89.0, "image_url": "/images/kb.png"},
    {"id": 2, "name": "Chuot khong day Silent M2", "price": 45.0, "image_url": "/images/mouse.png"},
]


class _ShopDb:
    """In-memory MiniShop subset answering queries issued by Lab 07 handlers."""

    def __init__(self) -> None:
        self.products: list[dict[str, Any]] = [dict(p) for p in _SEED_PRODUCTS]

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        assert "WHERE username = $1" in query
        user = _USERS.get(str(args[0]))
        return None if user is None else dict(user)

    async def fetch_all(self, query: str, *args: object) -> list[dict[str, Any]]:
        _ = args
        assert "FROM products" in query
        return [dict(p) for p in self.products]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        assert "FROM products WHERE id = $1" in query
        product_id = args[0]
        return product_id if any(p["id"] == product_id for p in self.products) else None

    async def execute(self, query: str, *args: object) -> str:
        assert "UPDATE products SET image_url = $1 WHERE id = $2" in query
        new_url, product_id = str(args[0]), args[1]
        for product in self.products:
            if product["id"] == product_id:
                product["image_url"] = new_url
                return "UPDATE 1"
        return "UPDATE 0"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        return nullcontext(self)


class _StubDatabaseManager(DatabaseManager):
    """DatabaseManager double whose reset restores seed products."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.db = _ShopDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        return self.db

    async def reset_database(self) -> float:
        self.db.products = [dict(p) for p in _SEED_PRODUCTS]
        return 1.0


def _client(
    tmp_path: Path,
    labs_dir: Path = _REPO_LABS_DIR,
) -> tuple[TestClient, _ShopDb, Path]:
    sandbox = tmp_path / "upload-sandbox"
    settings = Settings(labs_dir=labs_dir, upload_sandbox_dir=sandbox, environment="test")
    manager = _StubDatabaseManager(settings)
    return TestClient(create_app(settings=settings, db_manager=manager)), manager.db, sandbox


def _upload(
    client: TestClient,
    mode: str,
    body: dict[str, Any],
    actor: str | None = "admin",
) -> dict[str, Any]:
    headers = {"X-VVWA-Actor": actor} if actor is not None else {}
    resp = client.post(f"{_LAB}/{mode}/upload_image", json=body, headers=headers)
    assert resp.status_code == 200
    payload: dict[str, Any] = resp.json()
    return payload


def test_lab_07_discovery_source_diff_and_zip(tmp_path: Path) -> None:
    """Lab 07 is discovered with actors, symmetric @step tags, clean diff, and ZIP."""
    client, _, _ = _client(tmp_path)
    labs = client.get("/api/labs").json()["labs"]
    lab = next(item for item in labs if item["id"] == "07-file-upload")
    assert lab["actors"] == ["admin", "alice"]
    assert len(lab["samplePayloads"]) == 5
    assert len(lab["verifyTests"]) == 7

    source = client.get(f"{_LAB}/source").json()
    expected_tags = {
        "require-session",
        "read-upload",
        "validate-upload",
        "build-upload-path",
        "write-file",
        "update-product",
    }
    assert expected_tags <= set(source["vulnerable"]["steps"])
    assert expected_tags <= set(source["secure"]["steps"])
    assert {"fe-upload-image", "fe-render-upload"} <= set(source["frontend"]["steps"])
    assert source["frontend_diff"] is None
    assert '+    stored_name = f"{uuid4().hex}.{ext}"' in source["diff"]

    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_lab_07_vulnerable_exploits_and_outer_jail_protection(tmp_path: Path) -> None:
    """Vulnerable mode accepts spoofed shell/SVG and webroot overwrite, while outer jail holds."""
    client, db, sandbox = _client(tmp_path)
    valid = _upload(
        client,
        "vulnerable",
        {
            "product_id": 1,
            "filename": "keyboard-new.png",
            "content_type": "image/png",
            "content_b64": _VALID_PNG_B64,
        },
    )
    assert valid["meta"]["outcome"] == "normal"
    assert valid["data"]["saved"] is True
    assert db.products[0]["image_url"] == "/uploads/keyboard-new.png"

    for fname, mime, b64 in [
        ("shell.py", "image/png", _SHELL_B64),
        ("banner.svg", "image/svg+xml", _SVG_B64),
        ("../index.html", "image/png", _HTML_B64),
    ]:
        exploited = _upload(
            client,
            "vulnerable",
            {"product_id": 1, "filename": fname, "content_type": mime, "content_b64": b64},
        )
        assert exploited["data"]["saved"] is True, fname
        assert exploited["meta"]["outcome"] == "exploited", fname

    assert (sandbox / "webroot" / "index.html").read_text(encoding="utf-8") == (
        "<h1>Hacked MiniShop</h1>"
    )

    listed = client.post(
        f"{_LAB}/vulnerable/list_products", json={}, headers={"X-VVWA-Actor": "admin"}
    ).json()
    risky = {f["relative_path"]: f["executable_risk"] for f in listed["data"]["files"]}
    assert risky["uploads/keyboard-new.png"] is False
    assert risky["uploads/shell.py"] is True
    assert risky["uploads/banner.svg"] is True
    assert risky["index.html"] is True

    # Attempt to escape outer sandbox jail into repo/app fails cleanly even in vulnerable mode.
    jailed = _upload(
        client,
        "vulnerable",
        {
            "product_id": 1,
            "filename": "../../../../app/core/backend/app/main.py",
            "content_type": "image/png",
            "content_b64": _SHELL_B64,
        },
    )
    assert jailed["ok"] is True
    assert jailed["data"]["saved"] is False
    assert jailed["meta"]["outcome"] == "blocked"

    # Reset DB restores both product rows and upload sandbox webroot.
    assert client.post("/api/system/reset-db").status_code == 200
    assert db.products[0]["image_url"] == "/images/kb.png"
    assert not (sandbox / "webroot" / "uploads" / "shell.py").exists()
    assert (sandbox / "webroot" / "index.html").read_text(encoding="utf-8") == DEFAULT_WEBROOT_INDEX


def test_lab_07_secure_enforces_magic_bytes_uuid_and_containment(tmp_path: Path) -> None:
    """Secure mode validates magic bytes/size/session and renames traversal PNGs safely."""
    client, db, sandbox = _client(tmp_path)
    ok = _upload(
        client,
        "secure",
        {
            "product_id": 1,
            "filename": "keyboard-new.png",
            "content_type": "image/png",
            "content_b64": _VALID_PNG_B64,
        },
    )
    assert ok["meta"]["outcome"] == "normal"
    assert ok["data"]["saved"] is True
    assert ok["data"]["stored_name"] != "keyboard-new.png"
    assert ok["data"]["stored_name"].endswith(".png")
    assert ok["data"]["escaped_uploads"] is False

    # Traversal filename carrying genuine PNG bytes is neutralized to a UUID inside uploads/.
    trav_png = _upload(
        client,
        "secure",
        {
            "product_id": 1,
            "filename": "../evil.png",
            "content_type": "image/png",
            "content_b64": _VALID_PNG_B64,
        },
        actor="alice",
    )
    assert trav_png["data"]["saved"] is True
    assert trav_png["data"]["escaped_uploads"] is False
    assert ".." not in trav_png["data"]["stored_name"]
    assert db.products[0]["image_url"].startswith("/uploads/")

    oversized_png_b64 = base64.b64encode(
        base64.b64decode(_VALID_PNG_B64) + b"\x00" * (256 * 1024)
    ).decode()
    for fname, mime, b64, actor in [
        ("shell.py", "image/png", _SHELL_B64, "admin"),
        ("banner.svg", "image/svg+xml", _SVG_B64, "admin"),
        ("../index.html", "image/png", _HTML_B64, "admin"),
        ("empty.png", "image/png", "", "admin"),
        ("bad.png", "image/png", "not-valid-base64!", "admin"),
        ("huge.png", "image/png", oversized_png_b64, "admin"),
        ("anon.png", "image/png", _VALID_PNG_B64, None),
    ]:
        denied = _upload(
            client,
            "secure",
            {"product_id": 1, "filename": fname, "content_type": mime, "content_b64": b64},
            actor=actor,
        )
        assert denied["data"]["saved"] is False, fname
        assert denied["data"]["url"] is None, fname
    assert (sandbox / "webroot" / "index.html").read_text(encoding="utf-8") == DEFAULT_WEBROOT_INDEX


def test_lab_07_verify_fails_unpatched_and_passes_with_secure(tmp_path: Path) -> None:
    """Test My Fix passes 2/7 unpatched and 7/7 once vulnerable.py is replaced with secure.py."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "07-file-upload", labs_dir / "07-file-upload")
    client, _, _ = _client(tmp_path, labs_dir=labs_dir)

    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 2, 7)

    backend = labs_dir / "07-file-upload" / "backend"
    (backend / "vulnerable.py").write_text(
        (backend / "secure.py").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True
    assert after["passed_count"] == 7
