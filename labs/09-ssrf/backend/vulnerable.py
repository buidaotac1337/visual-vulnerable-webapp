"""Lab 09 (Vulnerable): Server-Side Request Forgery when fetching product image URLs.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
fetch_product_image passes the user-supplied URL directly into httpx.AsyncClient
with follow_redirects=True and no scheme, hostname allowlist, DNS/IP filtering,
or response content-type/magic-bytes enforcement.
"""

from typing import Any
from urllib.parse import urlparse

import httpx

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_PRODUCTS_SQL = "SELECT id, name, price, image_url FROM products ORDER BY id"
_PRODUCT_EXISTS_SQL = "SELECT id FROM products WHERE id = $1"
_UPDATE_IMAGE_SQL = "UPDATE products SET image_url = $1 WHERE id = $2"
_REQUEST_TIMEOUT = 3.0
_HTTP_OK = 200
_HTTP_ERROR_MIN = 400
_MAX_DB_URL_LEN = 255
_PREVIEW_CHAR_LIMIT = 4096
_WEBP_HEADER_BYTES = 12
_INTERNAL_HOSTS = frozenset(
    {
        "internal-metadata",
        "localhost",
        "127.0.0.1",
        "::1",
        "169.254.169.254",
        "backend",
        "postgres",
    },
)
_SECRET_MARKERS = (
    "ASIA-VVWA-DEMO",
    "vvwa_demo_iam_secret",
    "vvwa_internal_jwt_secret",
    "minishop-prod-iam-role",
    "lab_admin_user",
)

Steps = list[dict[str, Any]]


def _as_int(value: Any, fallback: int) -> int:  # noqa: ANN401
    """Parse product_id safely without raising on non-numeric client input."""
    if isinstance(value, bool):
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _detect_image_ext(data: bytes) -> str | None:
    """Identify image extension from magic bytes."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if len(data) >= _WEBP_HEADER_BYTES and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one execution trace step matching an # @step:<tag> marker."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _response_envelope(
    data: dict[str, Any],
    steps: Steps,
    outcome: str,
) -> dict[str, Any]:
    """Wrap response data, outcome metadata, and trace steps into the VVWA contract."""
    return {"data": data, "meta": {"outcome": outcome}, "trace": steps}


def _failure_result(
    product_id: int,
    requested_url: str,
    steps: Steps,
    error: str,
    *,
    blocked: bool = False,
) -> dict[str, Any]:
    """Build a standardized non-updated response when session, URL, or fetch fails."""
    outcome = "blocked" if blocked else "normal"
    data = {
        "fetched": False,
        "updated": False,
        "blocked": blocked,
        "leaked_internal": False,
        "product_id": product_id,
        "requested_url": requested_url,
        "final_url": None,
        "status_code": None,
        "content_type": None,
        "size_bytes": 0,
        "detected_type": None,
        "body_preview": None,
        "error": error,
    }
    return _response_envelope(data, steps, outcome)


def _is_internal_leak(
    final_url: str,
    status_code: int,
    content_type: str,
    body_preview: str,
) -> bool:
    """Detect when an unvalidated fetch reached internal/non-image data."""
    media_type = content_type.split(";", maxsplit=1)[0].strip().lower()
    if media_type.startswith("image/"):
        return False
    final_host = (urlparse(final_url).hostname or "").strip("[]").lower()
    has_secret = any(marker in body_preview for marker in _SECRET_MARKERS)
    return status_code < _HTTP_ERROR_MIN or final_host in _INTERNAL_HOSTS or has_secret


def _evaluate_fetched_response(
    product_id: int,
    requested_url: str,
    response: httpx.Response,
    steps: Steps,
) -> tuple[dict[str, Any], bool]:
    """Classify an HTTP response as a valid image update, SSRF leak, or non-image failure."""
    final_url = str(response.url)
    content_type = response.headers.get("content-type", "")
    raw = response.content
    detected_type = _detect_image_ext(raw)
    media_type = content_type.split(";", maxsplit=1)[0].strip().lower()
    is_valid_image = (
        response.status_code == _HTTP_OK
        and media_type.startswith("image/")
        and detected_type is not None
    )
    body_preview = (
        None if is_valid_image else raw[:_PREVIEW_CHAR_LIMIT].decode("utf-8", errors="replace")
    )
    leaked = (
        False
        if body_preview is None
        else _is_internal_leak(final_url, response.status_code, content_type, body_preview)
    )
    data = {
        "fetched": True,
        "updated": False,
        "blocked": False,
        "leaked_internal": leaked,
        "product_id": product_id,
        "requested_url": requested_url,
        "final_url": final_url,
        "status_code": response.status_code,
        "content_type": content_type,
        "size_bytes": len(raw),
        "detected_type": detected_type,
        "body_preview": body_preview,
        "error": None
        if (is_valid_image or leaked)
        else f"HTTP {response.status_code} không phải ảnh.",
    }
    if leaked:
        detail = f"{final_url} -> HTTP {response.status_code} ({media_type or 'unknown'})"
        steps.append(_step("backend", "fetch-url", "danger", "SSRF rò rỉ dữ liệu nội bộ!", detail))
    elif not is_valid_image:
        steps.append(_step("backend", "fetch-url", "warning", "Phản hồi không phải ảnh", final_url))
    else:
        steps.append(_step("backend", "fetch-url", "info", "Tải ảnh thành công", final_url))
    return data, is_valid_image


async def list_products(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """List MiniShop products so LabView can display current product image URLs."""
    _ = (payload, ctx)
    products = await db.fetch_all(_PRODUCTS_SQL)
    return _response_envelope({"products": products}, [], "normal")


# @snippet:start
async def fetch_product_image(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Fetch a product image from URL (VULNERABLE: no allowlist/IP check, follows redirects)."""
    # @step:require-session
    if ctx.actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _failure_result(0, "", [step], "Cần đăng nhập để kiểm tra ảnh.", blocked=True)

    # @step:parse-url
    product_id = _as_int(payload.get("product_id"), 1)
    raw_url = str(payload.get("image_url", "")).strip()
    steps: Steps = [_step("backend", "parse-url", "info", "Đọc URL từ client", raw_url)]
    if await db.fetch_val(_PRODUCT_EXISTS_SQL, product_id) is None:
        return _failure_result(
            product_id, raw_url, steps, f"Không tìm thấy sản phẩm #{product_id}."
        )
    if not raw_url:
        return _failure_result(
            product_id, raw_url, steps, "URL ảnh không được để trống.", blocked=True
        )
    parsed = urlparse(raw_url)

    # @step:validate-target
    target_desc = parsed.hostname or raw_url
    steps.append(
        _step(
            "backend",
            "validate-target",
            "warning",
            "Bỏ qua kiểm tra allowlist & IP",
            f"Tin trực tiếp URL đích {target_desc!r} không lọc scheme/DNS/IP.",
        ),
    )

    # @step:fetch-url
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=_REQUEST_TIMEOUT) as client:
            response = await client.get(raw_url)
    except (httpx.HTTPError, ValueError) as exc:
        steps.append(_step("backend", "fetch-url", "warning", "Lỗi tải URL", str(exc)))
        return _failure_result(product_id, raw_url, steps, str(exc))

    data, is_valid_image = _evaluate_fetched_response(product_id, raw_url, response, steps)
    if not is_valid_image:
        outcome = "exploited" if data["leaked_internal"] else "normal"
        return _response_envelope(data, steps, outcome)

    # @step:update-product
    final_url = str(data["final_url"])[:_MAX_DB_URL_LEN]
    await db.execute(_UPDATE_IMAGE_SQL, final_url, product_id)
    data["updated"] = True
    steps.append(_step("database", "update-product", "info", "Cập nhật ảnh sản phẩm", final_url))
    return _response_envelope(data, steps, "normal")


# @snippet:end
