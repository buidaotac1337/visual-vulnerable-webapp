"""Lab 09 (Secure): SSRF-hardened product image fetcher with defense-in-depth.

Validates session actor, http/https scheme without credentials, hostname allowlist,
DNS/IP rules (blocking loopback/link-local/non-global and private IPs except demo CDN),
follow_redirects=False, Content-Type, magic bytes, and size ceiling (<= 256 KiB).
"""

import asyncio
import ipaddress
import socket
from typing import Any
from urllib.parse import ParseResult, urlparse

import httpx

from app.core import get_settings
from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_PRODUCTS_SQL = "SELECT id, name, price, image_url FROM products ORDER BY id"
_PRODUCT_EXISTS_SQL = "SELECT id FROM products WHERE id = $1"
_UPDATE_IMAGE_SQL = "UPDATE products SET image_url = $1 WHERE id = $2"
_REQUEST_TIMEOUT = 3.0
_HTTP_OK, _HTTP_PORT, _HTTPS_PORT = 200, 80, 443
_MAX_IMAGE_BYTES = 256 * 1024
_MAX_DB_URL_LEN, _WEBP_HEADER_BYTES = 255, 12
_ALLOWED_SCHEMES = frozenset({"http", "https"})
_ALLOWED_MIME_TO_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}

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
    """Identify image extension strictly from file magic bytes."""
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


def _result(
    product_id: int,
    requested_url: str,
    steps: Steps,
    *,
    outcome: str = "blocked",
    **fields: object,
) -> dict[str, Any]:
    """Build a uniform Lab 09 response envelope with safe defaults."""
    data: dict[str, Any] = {
        "fetched": False,
        "updated": False,
        "blocked": outcome == "blocked",
        "leaked_internal": False,
        "product_id": product_id,
        "requested_url": requested_url,
        "final_url": None,
        "status_code": None,
        "content_type": None,
        "size_bytes": 0,
        "detected_type": None,
        "body_preview": None,
        "error": None,
        **fields,
    }
    return {"data": data, "meta": {"outcome": outcome}, "trace": steps}


def _parse_safe_http_url(raw_url: str) -> tuple[ParseResult | None, int | None, str | None]:
    """Validate URL syntax, http/https scheme, hostname presence, and absence of userinfo."""
    if not raw_url or "\\" in raw_url or any(ch.isspace() for ch in raw_url):
        return None, None, "URL không hợp lệ hoặc chứa ký tự điều khiển."
    parsed = urlparse(raw_url)
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return None, None, f"Chỉ cho phép scheme http/https (nhận {parsed.scheme!r})."
    if parsed.username is not None or parsed.password is not None:
        return None, None, "Không cho phép nhúng thông tin xác thực (user:pass@) trong URL."
    if not parsed.hostname:
        return None, None, "URL thiếu hostname hợp lệ."
    try:
        explicit_port = parsed.port
    except ValueError:
        return None, None, "Cổng (port) trong URL không hợp lệ."
    port = explicit_port or (_HTTPS_PORT if parsed.scheme.lower() == "https" else _HTTP_PORT)
    return parsed, port, None


def _check_resolved_ip(raw_ip: str, *, allow_demo: bool) -> str | None:
    """Parse IP, unwrap IPv4-mapped IPv6, and return IP string if allowed, else None."""
    try:
        addr = ipaddress.ip_address(raw_ip.split("%", maxsplit=1)[0])
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped
    blocked = (
        addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        or (not allow_demo if addr.is_private else not addr.is_global)
    )
    return None if blocked else str(addr)


async def _validate_host_and_dns(hostname: str, port: int) -> tuple[list[str], str | None]:
    """Check hostname allowlist and verify every resolved DNS IP against SSRF IP rules."""
    settings = get_settings()
    normalized = hostname.rstrip(".").lower()
    if normalized not in settings.ssrf_allowed_host_set:
        return [], f"Host '{normalized}' không nằm trong allowlist được phép."
    try:
        records = await asyncio.to_thread(
            socket.getaddrinfo, normalized, port, 0, socket.SOCK_STREAM
        )
    except OSError as exc:
        return [], f"Không thể phân giải DNS cho '{normalized}': {exc}"

    allow_demo = normalized == settings.ssrf_demo_cdn_host.strip().lower()
    resolved_ips: list[str] = []
    for record in records:
        safe_ip = _check_resolved_ip(str(record[4][0]), allow_demo=allow_demo)
        if safe_ip is None:
            return [], f"Chặn IP nội bộ/không công khai ({record[4][0]}) cho '{normalized}'."
        resolved_ips.append(safe_ip)
    if not resolved_ips:
        return [], f"DNS không trả về địa chỉ IP nào cho '{normalized}'."
    return sorted(set(resolved_ips)), None


def _validate_image_response(response: httpx.Response) -> tuple[str | None, str | None]:
    """Validate non-redirect 200 status, Content-Type allowlist, size limit, and magic bytes."""
    if response.is_redirect:
        return None, f"Chặn chuyển hướng HTTP {response.status_code} (chống bypass allowlist)."
    if response.status_code != _HTTP_OK:
        return None, f"Máy chủ ảnh trả về mã HTTP {response.status_code} (yêu cầu 200)."
    media_type = response.headers.get("content-type", "").split(";", maxsplit=1)[0].strip().lower()
    expected_ext = _ALLOWED_MIME_TO_EXT.get(media_type)
    if expected_ext is None:
        return None, f"Content-Type '{media_type or 'unknown'}' không thuộc danh sách ảnh cho phép."
    raw = response.content
    if not 0 < len(raw) <= _MAX_IMAGE_BYTES:
        return None, f"Kích thước phản hồi ({len(raw)} B) vượt ngưỡng 1..{_MAX_IMAGE_BYTES} B."
    if _detect_image_ext(raw) != expected_ext:
        return None, "Magic bytes không khớp với Content-Type ảnh khai báo."
    return expected_ext, None


async def list_products(
    payload: dict[str, Any], db: LabDatabaseProtocol, ctx: LabContext
) -> dict[str, Any]:
    """List MiniShop products so LabView can display current product image URLs."""
    _ = (payload, ctx)
    products = await db.fetch_all(_PRODUCTS_SQL)
    return {"data": {"products": products}, "meta": {"outcome": "normal"}, "trace": []}


# @snippet:start
async def fetch_product_image(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Fetch a product image from URL (SECURE: allowlist, DNS/IP filter, no redirects)."""
    # @step:require-session
    if ctx.actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _result(0, "", [step], error="Cần đăng nhập để kiểm tra ảnh.")

    # @step:parse-url
    product_id = _as_int(payload.get("product_id"), 1)
    raw_url = str(payload.get("image_url", "")).strip()
    steps: Steps = []
    if await db.fetch_val(_PRODUCT_EXISTS_SQL, product_id) is None:
        msg = f"Không tìm thấy sản phẩm #{product_id}."
        return _result(product_id, raw_url, steps, outcome="normal", error=msg)
    parsed, port, parse_err = _parse_safe_http_url(raw_url)
    if parsed is None or port is None or parse_err is not None:
        msg = parse_err or "URL không hợp lệ."
        steps.append(_step("backend", "parse-url", "safe", "Chặn URL không hợp lệ", msg))
        return _result(product_id, raw_url, steps, error=msg)
    steps.append(_step("backend", "parse-url", "info", "Phân tích URL http/https", raw_url))

    # @step:validate-target
    ips, target_err = await _validate_host_and_dns(parsed.hostname or "", port)
    if target_err is not None:
        steps.append(_step("backend", "validate-target", "safe", "Chặn đích SSRF", target_err))
        return _result(product_id, raw_url, steps, error=target_err)
    steps.append(
        _step("backend", "validate-target", "safe", "Allowlist & DNS hợp lệ", ", ".join(ips))
    )

    # @step:fetch-url
    response: httpx.Response | None = None
    fetch_err: str | None = None
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=_REQUEST_TIMEOUT) as client:
            response = await client.get(raw_url)
    except httpx.HTTPError as exc:
        fetch_err = str(exc)

    detected_ext, resp_err = (
        (None, fetch_err) if response is None else _validate_image_response(response)
    )
    if response is None or detected_ext is None or resp_err is not None:
        msg = resp_err or "Phản hồi bị từ chối."
        steps.append(_step("backend", "fetch-url", "safe", "Chặn phản hồi không hợp lệ", msg))
        return _result(product_id, raw_url, steps, error=msg)
    steps.append(_step("backend", "fetch-url", "safe", f"Xác thực ảnh {detected_ext}", raw_url))

    # @step:update-product
    final_url = str(response.url)[:_MAX_DB_URL_LEN]
    await db.execute(_UPDATE_IMAGE_SQL, final_url, product_id)
    steps.append(_step("database", "update-product", "info", "Cập nhật ảnh sản phẩm", final_url))
    return _result(
        product_id,
        raw_url,
        steps,
        outcome="normal",
        fetched=True,
        updated=True,
        final_url=str(response.url),
        status_code=response.status_code,
        content_type=response.headers.get("content-type", ""),
        size_bytes=len(response.content),
        detected_type=detected_ext,
    )


# @snippet:end
