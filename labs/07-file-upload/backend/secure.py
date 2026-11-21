"""Lab 07 (Secure): Product image upload with magic bytes and UUID storage.

Validates authenticated session (ctx.actor), decodes base64 with a size ceiling,
detects real image type from magic bytes (PNG/JPEG/WebP), ignores client
filename/MIME completely, generates a server UUID filename, and confines writes
strictly inside <sandbox>/webroot/uploads/ (ADR-0007).
"""

import base64
import binascii
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core import get_settings
from app.db import LabDatabaseProtocol
from app.schemas import LabContext
from app.services import (
    DEFAULT_WEBROOT_INDEX,
    ensure_upload_sandbox,
    write_within_sandbox_jail,
)

_PRODUCTS_SQL = "SELECT id, name, price, image_url FROM products ORDER BY id"
_PRODUCT_EXISTS_SQL = "SELECT id FROM products WHERE id = $1"
_UPDATE_IMAGE_SQL = "UPDATE products SET image_url = $1 WHERE id = $2"
_MAX_IMAGE_BYTES = 256 * 1024
_WEBP_HEADER_BYTES = 12
_SAFE_IMAGE_SUFFIXES = frozenset({".png", ".jpg", ".jpeg", ".webp"})

Steps = list[dict[str, Any]]


def _sandbox_dir(ctx: LabContext) -> Path:
    """Resolve the isolated upload sandbox directory from engine context or Settings."""
    return ctx.upload_sandbox_dir or get_settings().upload_sandbox_dir


def _detect_image_ext(data: bytes) -> str | None:
    """Identify image extension strictly from file magic bytes."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if len(data) >= _WEBP_HEADER_BYTES and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _decode_base64(content_b64: str) -> bytes | None:
    """Decode strict base64 text to bytes, returning None on malformed input."""
    try:
        return base64.b64decode(content_b64, validate=True)
    except (ValueError, binascii.Error):
        return None


def _as_int(value: Any, fallback: int) -> int:  # noqa: ANN401
    """Parse an integer product_id safely without raising on malformed client input."""
    if isinstance(value, bool):
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _parse_upload_fields(payload: dict[str, Any]) -> tuple[int, str, str, str]:
    """Extract untrusted upload request fields from JSON payload."""
    return (
        _as_int(payload.get("product_id"), 1),
        str(payload.get("filename", "")),
        str(payload.get("content_type", "")),
        str(payload.get("content_b64", "")).strip(),
    )


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one raw trace step for the @step tag of the highlighted line."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _read_step(product_id: int, filename: str, content_type: str) -> dict[str, Any]:
    """Build the initial trace step describing client-supplied upload metadata."""
    detail = f"product_id={product_id}, filename={filename!r}, content_type={content_type!r}"
    return _step("backend", "read-upload", "info", "Đọc metadata upload từ client", detail)


def _rejected(
    product_id: int,
    filename: str,
    steps: Steps,
    error: str,
    outcome: str,
) -> dict[str, Any]:
    """Build a standardized failed/blocked upload response envelope."""
    data = {
        "saved": False,
        "product_id": product_id,
        "original_name": filename,
        "stored_name": None,
        "url": None,
        "detected_type": None,
        "escaped_uploads": False,
        "size_bytes": 0,
        "error": error,
    }
    return {"data": data, "meta": {"outcome": outcome}, "trace": steps}


def _list_webroot_files(webroot_dir: Path, uploads_dir: Path) -> list[dict[str, Any]]:
    """Inventory files currently inside <sandbox>/webroot/ with risk flags."""
    resolved_root = webroot_dir.resolve()
    resolved_uploads = uploads_dir.resolve()
    entries: list[dict[str, Any]] = []
    for path in sorted(resolved_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(resolved_root).as_posix()
        in_uploads = path.resolve().is_relative_to(resolved_uploads)
        raw = path.read_bytes()
        is_default = rel == "index.html" and raw.decode("utf-8", "replace") == DEFAULT_WEBROOT_INDEX
        safe_img = (
            in_uploads
            and path.suffix.lower() in _SAFE_IMAGE_SUFFIXES
            and _detect_image_ext(raw) is not None
        )
        entries.append(
            {
                "relative_path": rel,
                "url": f"/{rel}",
                "in_uploads": in_uploads,
                "size_bytes": len(raw),
                "executable_risk": not (is_default or safe_img),
            },
        )
    return entries


async def list_products(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """List MiniShop products and current files inside the isolated webroot."""
    _ = payload
    webroot_dir, uploads_dir = ensure_upload_sandbox(_sandbox_dir(ctx))
    products = await db.fetch_all(_PRODUCTS_SQL)
    files = _list_webroot_files(webroot_dir, uploads_dir)
    return {
        "data": {"products": products, "files": files},
        "meta": {"outcome": "normal"},
        "trace": [],
    }


# @snippet:start
async def upload_image(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Upload a product image (SECURE: magic bytes, random UUID name, uploads containment)."""
    sandbox_dir = _sandbox_dir(ctx)
    _webroot_dir, uploads_dir = ensure_upload_sandbox(sandbox_dir)
    # @step:require-session
    if ctx.actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _rejected(0, "", [step], "Cần đăng nhập để tải ảnh sản phẩm.", "normal")

    # @step:read-upload
    product_id, filename, content_type, content_b64 = _parse_upload_fields(payload)
    steps: Steps = [_read_step(product_id, filename, content_type)]
    if await db.fetch_val(_PRODUCT_EXISTS_SQL, product_id) is None:
        return _rejected(product_id, filename, steps, f"Không có sản phẩm #{product_id}.", "normal")

    raw = _decode_base64(content_b64)
    # @step:validate-upload
    ext = _detect_image_ext(raw) if raw is not None and 0 < len(raw) <= _MAX_IMAGE_BYTES else None
    if raw is None or ext is None:
        detail = f"Magic bytes không hợp lệ (size={0 if raw is None else len(raw)} B)."
        steps.append(_step("backend", "validate-upload", "safe", "Từ chối file", detail))
        msg = "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ (tối đa 256 KiB)."
        return _rejected(product_id, filename, steps, msg, "blocked")
    steps.append(
        _step("backend", "validate-upload", "safe", f"Magic bytes: {ext}", f"{len(raw)} B")
    )

    # @step:build-upload-path
    stored_name = f"{uuid4().hex}.{ext}"
    resolved_uploads = uploads_dir.resolve()
    target_path = (resolved_uploads / stored_name).resolve()
    if not target_path.is_relative_to(resolved_uploads):
        steps.append(_step("backend", "build-upload-path", "safe", "Chặn thoát", str(target_path)))
        return _rejected(product_id, filename, steps, "Đường dẫn lưu file không hợp lệ.", "blocked")
    steps.append(_step("backend", "build-upload-path", "safe", "Sinh tên UUID", stored_name))

    # @step:write-file
    written = write_within_sandbox_jail(sandbox_dir, target_path, raw)
    url = f"/uploads/{stored_name}"
    steps.append(_step("backend", "write-file", "safe", "Ghi vào uploads/", str(written)))

    # @step:update-product
    await db.execute(_UPDATE_IMAGE_SQL, url, product_id)
    steps.append(
        _step("database", "update-product", "info", "Cập nhật ảnh", f"#{product_id} -> {url}")
    )
    data = {
        "saved": True,
        "product_id": product_id,
        "original_name": filename,
        "stored_name": stored_name,
        "url": url,
        "detected_type": ext,
        "escaped_uploads": False,
        "size_bytes": len(raw),
        "error": None,
    }
    return {"data": data, "meta": {"outcome": "normal"}, "trace": steps}


# @snippet:end
