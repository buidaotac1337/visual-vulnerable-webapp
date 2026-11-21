"""Lab 06 (Vulnerable): Path traversal on the MiniShop invoice download.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
download_invoice glues the file name sent by the client onto the invoice folder,
so '../' segments walk out of it and any readable file on the server is returned.
Students patch this file and verify the fix with Test My Fix.
"""

import os
import re
import tempfile
from pathlib import Path
from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_ORDERS_SQL = (
    "SELECT o.id, u.username, o.status, o.total_amount, o.shipping_address "
    "FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id"
)
_EXPORT_SQL = "SELECT username, email, balance FROM users ORDER BY id"
_OWNER_SQL = "SELECT 1 FROM orders WHERE id = $1 AND user_id = $2"
_MY_ORDERS_SQL = "SELECT id, total_amount FROM orders WHERE user_id = $1 ORDER BY id"
_MAX_BYTES = 4096
_INVOICE_RE = re.compile(r"\AINV-([0-9]{4})\.txt\Z")
_SECRETS = "# MiniShop internal config (demo, not real)\nMINISHOP_ADMIN_TOKEN=lab06-demo-token\n"

Steps = list[dict[str, Any]]


def _base_dir() -> Path:
    """Return the lab sandbox folder (never a folder mounted from the host)."""
    # "or": an empty VVWA_LAB06_DIR must not fall back to the current folder.
    return Path(os.environ.get("VVWA_LAB06_DIR") or Path(tempfile.gettempdir()) / "vvwa-minishop")


def _invoice_name(order_id: int) -> str:
    """Return the invoice file name of an order, e.g. 'INV-0001.txt'."""
    return f"INV-{order_id:04d}.txt"


async def _prepare_files(db: LabDatabaseProtocol) -> Path:
    """Write one invoice per order, an internal export, and a config file; drop stale invoices.

    Args:
        db: Restricted lab database adapter.

    Returns:
        The invoice folder.
    """
    invoices = _base_dir() / "invoices"
    (_base_dir() / "config").mkdir(parents=True, exist_ok=True)
    invoices.mkdir(parents=True, exist_ok=True)
    (_base_dir() / "config" / "secrets.env").write_text(_SECRETS, encoding="utf-8")
    users = await db.fetch_all(_EXPORT_SQL)
    export = "".join(f"{u['username']},{u['email']},{u['balance']}\n" for u in users)
    (invoices / "export.csv").write_text("username,email,balance\n" + export, encoding="utf-8")
    current = set()
    for order in await db.fetch_all(_ORDERS_SQL):
        name = _invoice_name(int(order["id"]))
        current.add(name)
        (invoices / name).write_text(
            f"MiniShop - Hóa đơn {name}\nĐơn hàng #{order['id']} của {order['username']}\n"
            f"Trạng thái: {order['status']}\nTổng tiền: ${order['total_amount']:.2f}\n"
            f"Giao tới: {order['shipping_address']}\n",
            encoding="utf-8",
        )
    for stale in invoices.glob("INV-*.txt"):
        if stale.name not in current:
            stale.unlink(missing_ok=True)
    return invoices


def _read_capped(path: Path) -> str | None:
    """Read at most _MAX_BYTES of a file as text, or None when it cannot be read."""
    try:
        with path.open("rb") as handle:
            return handle.read(_MAX_BYTES).decode("utf-8", errors="replace")
    except (OSError, ValueError):  # ValueError: embedded null byte
        return None


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one raw trace step for the @step tag of the highlighted line."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _name_step(name: str) -> dict[str, Any]:
    """Describe the file name read from the request."""
    return _step(
        "backend", "read-file-name", "info", "Đọc tên file từ URL (client kiểm soát)", repr(name)
    )


def _not_found(name: str, steps: Steps, outcome: str) -> dict[str, Any]:
    """Build the single 'not found' response used for every denied download."""
    return {
        "data": {
            "found": False,
            "file": name,
            "content": None,
            "error": f"Không có hóa đơn {name}.",
        },
        "meta": {"outcome": outcome},
        "trace": steps,
    }


def _resolve(path: str) -> Path | None:
    """Resolve a path, or None when the OS rejects it (null byte, too long, symlink loop)."""
    try:
        return Path(path).resolve()
    except (OSError, ValueError, RuntimeError):
        return None


async def _leak_reason(db: LabDatabaseProtocol, name: str, real: Path, user_id: int) -> str:
    """Explain why a returned file is not a plain request for the user's own invoice.

    Args:
        db: Restricted lab database adapter.
        name: File name sent by the client.
        real: Resolved path that was read.
        user_id: Session user id.

    Returns:
        Trace title for a leak, or '' for the user's own invoice asked by its plain name.
    """
    if name != real.name or real.parent != (_base_dir() / "invoices").resolve():
        return "Tên file chứa đường dẫn: server đọc theo đường dẫn client chọn!"
    match = _INVOICE_RE.fullmatch(real.name)
    if match is None or await db.fetch_val(_OWNER_SQL, int(match[1]), user_id) is None:
        return "Trả về file không phải hóa đơn của bạn!"
    return ""


async def list_invoices(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """List the invoice files of the logged-in user ('Hóa đơn của tôi')."""
    _ = payload
    await _prepare_files(db)
    orders = [] if ctx.actor is None else await db.fetch_all(_MY_ORDERS_SQL, ctx.actor.id)
    files = [
        {
            "order_id": o["id"],
            "file": _invoice_name(int(o["id"])),
            "total_amount": o["total_amount"],
        }
        for o in orders
    ]
    return {"data": {"invoices": files}, "meta": {"outcome": "normal"}, "trace": []}


# @snippet:start
async def download_invoice(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Return an invoice file (VULNERABLE: the client's file name is used as a path)."""
    invoice_dir = await _prepare_files(db)
    # @step:read-file-name
    name = str(payload.get("file", ""))
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _not_found(name, [step], "normal")
    steps: Steps = [_name_step(name)]

    # @step:build-path
    path = f"{invoice_dir}/{name}"
    real = _resolve(path)
    detail = f"{path}  ->  đường dẫn thật: {real}"
    steps.append(_step("backend", "build-path", "warning", "Ghép tên file vào thư mục", detail))
    # @step:read-file
    content = _read_capped(Path(path))
    if content is None or real is None:
        steps.append(_step("backend", "read-file", "info", "Không đọc được file", str(real)))
        return _not_found(name, steps, "normal")

    reason = await _leak_reason(db, name, real, actor.id)
    status = "danger" if reason else "info"
    steps.append(_step("backend", "read-file", status, reason or "Trả hóa đơn của bạn", str(real)))
    return {
        "data": {"found": True, "file": name, "content": content, "error": None},
        "meta": {"outcome": "exploited" if reason else "normal"},
        "trace": steps,
    }


# @snippet:end
