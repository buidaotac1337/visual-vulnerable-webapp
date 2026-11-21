"""Internal-only FastAPI demo sidecar serving mock cloud metadata and MiniShop CDN assets."""

import base64
import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse

_DEFAULT_METADATA_BASE_URL = "http://internal-metadata:8090"
_CDN_IMAGES = frozenset({"kb.png", "mouse.png", "headset.png"})
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPwd3sKAAJiAXvBJn9xAAAAAElFTkSuQmCC",
)


def _request_host(request: Request) -> str:
    """Extract normalized lowercase hostname from the incoming HTTP Host header."""
    raw = request.headers.get("host", "").strip().lower()
    if raw.startswith("["):
        return raw.split("]", maxsplit=1)[0].lstrip("[")
    return raw.split(":", maxsplit=1)[0]


def _is_cdn_vhost(request: Request) -> bool:
    """Return True when the request targets the public demo CDN virtual host."""
    return _request_host(request).startswith("minishop-cdn")


def _is_metadata_vhost(request: Request) -> bool:
    """Return True when the request targets the internal metadata virtual host."""
    return _request_host(request).startswith("internal-metadata")


def create_internal_demo_app(metadata_base_url: str | None = None) -> FastAPI:
    """Construct the internal-only SSRF demo FastAPI application.

    Virtual-host routing separates ``minishop-cdn*`` (CDN images and 302 redirect)
    from ``internal-metadata*`` (mock IAM credentials and internal admin config).
    Loopback hosts (``127.0.0.1`` / ``localhost`` / ``testserver``) can exercise both
    sets of routes in isolated offline tests.

    Args:
        metadata_base_url: Optional base URL for the 302 redirect target (for offline tests).

    Returns:
        Configured FastAPI instance for the sidecar service.
    """
    resolved_base = (
        metadata_base_url
        if metadata_base_url is not None
        else os.environ.get("VVWA_INTERNAL_METADATA_URL", _DEFAULT_METADATA_BASE_URL)
    ).rstrip("/")
    redirect_target = f"{resolved_base}/latest/meta-data/iam-credentials"

    demo_app = FastAPI(title="VVWA Internal Demo Target", version="0.1.0")

    @demo_app.get("/health")
    async def health() -> dict[str, str]:
        """Return readiness status for Docker Compose healthchecks."""
        return {"status": "ok"}

    @demo_app.get("/latest/meta-data/iam-credentials")
    async def iam_credentials(request: Request) -> JSONResponse:
        """Serve mock cloud IAM role credentials only on internal-metadata or loopback hosts."""
        if _is_cdn_vhost(request):
            raise HTTPException(status_code=404, detail="Not found on minishop-cdn")
        payload: dict[str, Any] = {
            "role": "minishop-prod-iam-role",
            "access_key_id": "ASIA-VVWA-DEMO-9001",
            "secret_access_key": "vvwa_demo_iam_secret_do_not_use",
            "token": "IQoJb3JpZ2luX2RlbW9fdG9rZW4=",
        }
        return JSONResponse(content=payload)

    @demo_app.get("/admin/config")
    async def admin_config(request: Request) -> JSONResponse:
        """Serve mock internal admin config only on internal-metadata or loopback hosts."""
        if _is_cdn_vhost(request):
            raise HTTPException(status_code=404, detail="Not found on minishop-cdn")
        payload: dict[str, Any] = {
            "service": "minishop-internal-admin",
            "jwt_signing_key": "vvwa_internal_jwt_secret_2026",
            "db_admin_dsn": "postgresql://lab_admin_user:***@postgres:5432/minishop",
        }
        return JSONResponse(content=payload)

    @demo_app.get("/cdn/redirect-to-metadata")
    async def redirect_to_metadata(request: Request) -> RedirectResponse:
        """Return an HTTP 302 redirect from the allowlisted CDN host to internal-metadata."""
        if _is_metadata_vhost(request):
            raise HTTPException(status_code=404, detail="Not found on internal-metadata")
        return RedirectResponse(url=redirect_target, status_code=302)

    @demo_app.get("/cdn/{filename}")
    async def cdn_image(filename: str, request: Request) -> Response:
        """Serve valid 1x1 PNG product assets for minishop-cdn or loopback test hosts."""
        if _is_metadata_vhost(request) or filename not in _CDN_IMAGES:
            raise HTTPException(status_code=404, detail="Image not found")
        return Response(content=_PNG_BYTES, media_type="image/png")

    return demo_app


app = create_internal_demo_app()
