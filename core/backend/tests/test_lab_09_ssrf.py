"""Integration tests for Lab 09 (09-ssrf): virtual-host target, SSRF leaks, defense, verify."""

import io
import shutil
import socket
import threading
import zipfile
from collections.abc import Iterator
from contextlib import AbstractAsyncContextManager, contextmanager, nullcontext
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import create_app
from app.core import Settings
from app.db import DatabaseManager, LabDatabaseProtocol
from app.internal_demo import create_internal_demo_app

_REPO_LABS_DIR = Path(__file__).resolve().parents[3] / "labs"
_LAB = "/api/labs/09-ssrf"
_USERS = {
    "admin": {"id": 1, "username": "admin", "role": "admin"},
    "alice": {"id": 2, "username": "alice", "role": "customer"},
}
_SEED = [{"id": 1, "name": "Ban phim co MiniShop K1", "price": 89.0, "image_url": "/images/kb.png"}]


class _ShopDb:
    """In-memory MiniShop subset answering queries issued by Lab 09 handlers."""

    def __init__(self) -> None:
        self.products: list[dict[str, Any]] = [dict(p) for p in _SEED]

    async def fetch_one(self, query: str, *args: object) -> dict[str, Any] | None:
        assert "WHERE username = $1" in query
        user = _USERS.get(str(args[0]))
        return None if user is None else dict(user)

    async def fetch_all(self, query: str, *_args: object) -> list[dict[str, Any]]:
        assert "FROM products" in query
        return [dict(p) for p in self.products]

    async def fetch_val(self, query: str, *args: object) -> Any:  # noqa: ANN401
        assert "FROM products WHERE id = $1" in query
        return args[0] if any(p["id"] == args[0] for p in self.products) else None

    async def execute(self, query: str, *args: object) -> str:
        assert "UPDATE products SET image_url = $1 WHERE id = $2" in query
        self.products[0]["image_url"] = str(args[0])
        return "UPDATE 1"

    def transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]:
        return nullcontext(self)


class _StubDbManager(DatabaseManager):
    """DatabaseManager double restoring seed products on reset."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.db = _ShopDb()

    async def get_lab_db(self) -> LabDatabaseProtocol:
        return self.db

    async def reset_database(self) -> float:
        self.db.products = [dict(p) for p in _SEED]
        return 1.0


class _OfflineRouterTransport(httpx.AsyncBaseTransport):
    """Route offline httpx requests to in-process ASGI transports by host/port."""

    def __init__(self, demo_app: FastAPI, api_app: FastAPI) -> None:
        self._demo = httpx.ASGITransport(app=demo_app)
        self._api = httpx.ASGITransport(app=api_app)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/cdn/not-image.png":
            return httpx.Response(200, headers={"content-type": "text/plain"}, content=b"not-png")
        if request.url.host in {"minishop-cdn", "internal-metadata", "cdn.example.com"}:
            return await self._demo.handle_async_request(request)
        if request.url.host == "127.0.0.1" and request.url.port == 8000:
            return await self._api.handle_async_request(request)
        raise httpx.ConnectError(f"Offline test blocked external host {request.url.host}")


def _make_client(
    labs_dir: Path = _REPO_LABS_DIR, settings: Settings | None = None
) -> tuple[TestClient, _ShopDb, FastAPI]:
    resolved = settings or Settings(labs_dir=labs_dir, environment="test")
    manager = _StubDbManager(resolved)
    app = create_app(settings=resolved, db_manager=manager)
    return TestClient(app), manager.db, app


def _fetch(client: TestClient, mode: str, url: str, actor: str | None = "admin") -> dict[str, Any]:
    headers = {"X-VVWA-Actor": actor} if actor is not None else {}
    resp = client.post(
        f"{_LAB}/{mode}/fetch_product_image",
        json={"product_id": 1, "image_url": url},
        headers=headers,
    )
    assert resp.status_code == 200
    payload: dict[str, Any] = resp.json()
    return payload


def _patch_network(
    monkeypatch: pytest.MonkeyPatch, api_app: FastAPI, dns_map: dict[str, list[str]]
) -> None:
    transport = _OfflineRouterTransport(create_internal_demo_app(), api_app)
    real_client = httpx.AsyncClient

    def _fake_dns(host: str, port: Any, *_a: object, **_k: object) -> list[tuple[Any, ...]]:  # noqa: ANN401
        ips = dns_map.get(host.lower())
        if not ips:
            raise socket.gaierror(f"Unknown test host {host}")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, int(port or 80))) for ip in ips]

    def _offline_client(**kwargs: Any) -> httpx.AsyncClient:  # noqa: ANN401
        return real_client(**{**kwargs, "transport": kwargs.get("transport", transport)})

    monkeypatch.setattr(socket, "getaddrinfo", _fake_dns)
    monkeypatch.setattr(httpx, "AsyncClient", _offline_client)


@contextmanager
def _loopback_demo_server() -> Iterator[int]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
    port = server.server_address[1]
    demo = TestClient(create_internal_demo_app(metadata_base_url=f"http://127.0.0.1:{port}"))

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            r = demo.get(self.path, headers=dict(self.headers), follow_redirects=False)
            self.send_response(r.status_code)
            for k, v in r.headers.items():
                if k.lower() not in {"content-length", "transfer-encoding", "connection"}:
                    self.send_header(k, v)
            self.send_header("Content-Length", str(len(r.content)))
            self.end_headers()
            self.wfile.write(r.content)

        def log_message(self, _fmt: str, *_args: object) -> None:
            return

    server.RequestHandlerClass = _Handler
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield port
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_lab_09_discovery_source_diff_and_zip() -> None:
    """Lab 09 exposes symmetric @step markers, clean diff, actors, and ZIP bundle."""
    client, _, _ = _make_client()
    lab = next(i for i in client.get("/api/labs").json()["labs"] if i["id"] == "09-ssrf")
    assert lab["actors"] == ["admin", "alice"]
    assert len(lab["samplePayloads"]) == 5 and len(lab["verifyTests"]) == 7
    source = client.get(f"{_LAB}/source").json()
    expected = {"require-session", "parse-url", "validate-target", "fetch-url", "update-product"}
    assert expected <= set(source["vulnerable"]["steps"]) <= set(source["secure"]["steps"])
    assert {"fe-fetch-url", "fe-render-preview"} <= set(source["frontend"]["steps"])
    assert "follow_redirects=False" in source["diff"] and source["frontend_diff"] is None
    with zipfile.ZipFile(io.BytesIO(client.get(f"{_LAB}/download").content)) as archive:
        assert set(archive.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}


def test_internal_demo_virtual_host_separation() -> None:
    """internal_demo enforces Host isolation between minishop-cdn and internal-metadata."""
    demo = TestClient(create_internal_demo_app())
    assert demo.get("/health").json() == {"status": "ok"}
    cdn, meta = {"Host": "minishop-cdn:8090"}, {"Host": "internal-metadata:8090"}
    png = demo.get("/cdn/kb.png", headers=cdn)
    assert png.status_code == 200 and png.content.startswith(b"\x89PNG\r\n\x1a\n")
    redir = demo.get("/cdn/redirect-to-metadata", headers=cdn, follow_redirects=False)
    assert redir.status_code == 302
    assert redir.headers["location"].endswith("/latest/meta-data/iam-credentials")
    for ep in ["/latest/meta-data/iam-credentials", "/admin/config"]:
        assert demo.get(ep, headers=cdn).status_code == 404
    iam = demo.get("/latest/meta-data/iam-credentials", headers=meta)
    cfg = demo.get("/admin/config", headers=meta)
    assert iam.status_code == 200 and iam.json()["access_key_id"] == "ASIA-VVWA-DEMO-9001"
    assert cfg.status_code == 200 and "vvwa_internal_jwt" in cfg.json()["jwt_signing_key"]
    assert demo.get("/cdn/kb.png", headers=meta).status_code == 404


def test_lab_09_vulnerable_loopback_http_and_exploits() -> None:
    """Vulnerable mode loads PNG, leaks IAM/config/redirect over real loopback, handles file://."""
    with _loopback_demo_server() as port:
        client, db, _ = _make_client()
        ok = _fetch(client, "vulnerable", f"http://127.0.0.1:{port}/cdn/kb.png")
        assert ok["meta"]["outcome"] == "normal" and ok["data"]["updated"]
        assert not ok["data"]["leaked_internal"]
        assert db.products[0]["image_url"] == f"http://127.0.0.1:{port}/cdn/kb.png"
        for path, marker in [
            ("/latest/meta-data/iam-credentials", "ASIA-VVWA-DEMO-9001"),
            ("/admin/config", "vvwa_internal_jwt_secret_2026"),
            ("/cdn/redirect-to-metadata", "ASIA-VVWA-DEMO-9001"),
        ]:
            leaked = _fetch(client, "vulnerable", f"http://127.0.0.1:{port}{path}")
            assert leaked["meta"]["outcome"] == "exploited" and leaked["data"]["leaked_internal"]
            assert marker in str(leaked["data"]["body_preview"])
        err = _fetch(client, "vulnerable", "file:///etc/passwd")
        assert err["ok"] and not err["data"]["fetched"] and err["data"]["blocked"] is False


def test_lab_09_secure_blocks_ssrf_redirects_and_dns_rebinding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Secure mode allows valid CDN PNG and blocks internal IPs, rebinding, redirects, bad MIME."""
    client, db, api_app = _make_client()
    dns_map = {"minishop-cdn": ["172.18.0.5"], "internal-metadata": ["172.18.0.5"]}
    _patch_network(monkeypatch, api_app, dns_map)
    ok = _fetch(client, "secure", "http://minishop-cdn:8090/cdn/kb.png")
    assert ok["meta"]["outcome"] == "normal" and ok["data"]["updated"] is True
    assert ok["data"]["detected_type"] == "png" and ok["data"]["body_preview"] is None
    assert db.products[0]["image_url"] == "http://minishop-cdn:8090/cdn/kb.png"

    hosts = ("127.0.0.1", "localhost", "[::1]", "[::ffff:127.0.0.1]")
    blocked_urls = [
        "http://internal-metadata:8090/latest/meta-data/iam-credentials",
        "http://internal-metadata:8090/admin/config",
        "http://minishop-cdn:8090/cdn/redirect-to-metadata",
        "http://minishop-cdn:8090/cdn/not-image.png",
        *[f"http://{h}:8000/api/health" for h in hosts],
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "file:///etc/passwd",
        "http://minishop-cdn@internal-metadata:8090/admin/config",
    ]
    for url in blocked_urls:
        d = _fetch(client, "secure", url)["data"]
        assert not d["fetched"] and d["blocked"] and d["body_preview"] is None, url
    anon = _fetch(client, "secure", "http://minishop-cdn:8090/cdn/kb.png", actor=None)
    assert anon["data"]["blocked"] is True

    for rebind_ip in ["127.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1"]:
        dns_map["minishop-cdn"] = [rebind_ip]
        rebound = _fetch(client, "secure", "http://minishop-cdn:8090/cdn/kb.png")
        assert rebound["data"]["blocked"] is True and rebound["data"]["fetched"] is False


def test_lab_09_verify_fails_unpatched_and_passes_with_secure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test My Fix passes 2/7 unpatched and 7/7 once vulnerable.py adopts secure.py."""
    labs_dir = tmp_path / "labs"
    shutil.copytree(_REPO_LABS_DIR / "09-ssrf", labs_dir / "09-ssrf")
    client, _, api_app = _make_client(labs_dir=labs_dir)
    dns = {"minishop-cdn": ["172.18.0.5"], "internal-metadata": ["172.18.0.5"]}
    _patch_network(monkeypatch, api_app, dns)
    before = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert (before["passed"], before["passed_count"], before["total"]) == (False, 2, 7)

    backend = labs_dir / "09-ssrf" / "backend"
    (backend / "vulnerable.py").write_text((backend / "secure.py").read_text("utf-8"), "utf-8")
    after = client.post(f"{_LAB}/verify?reset_db=true").json()
    assert after["passed"] is True and after["passed_count"] == 7
