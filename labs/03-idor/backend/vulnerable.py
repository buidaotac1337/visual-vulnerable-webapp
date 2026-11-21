"""Lab 03 (Vulnerable): IDOR on the MiniShop order detail page.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
view_order trusts the order_id sent by the client and never checks who owns the
order. Students patch this file and verify the fix with Test My Fix.
"""

from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_LIST_SQL = "SELECT id, status, total_amount, created_at FROM orders WHERE user_id = $1 ORDER BY id"
_ITEMS_SQL = (
    "SELECT p.name, i.quantity, i.unit_price FROM order_items i "
    "JOIN products p ON p.id = i.product_id WHERE i.order_id = $1 ORDER BY i.id"
)


def _as_int(value: object, default: int) -> int:
    """Convert a JSON value to int, falling back to a default.

    Args:
        value: Raw payload value.
        default: Value used when conversion fails.

    Returns:
        Parsed integer.
    """
    try:
        return int(str(value))
    except ValueError:
        return default


def _not_found(order_id: int, steps: list[dict[str, Any]], outcome: str) -> dict[str, Any]:
    """Build the single 'not found' response used for every denied lookup.

    Args:
        order_id: Requested order identifier.
        steps: Trace steps collected so far.
        outcome: Pedagogical outcome label.

    Returns:
        Lab execution dictionary that reveals nothing about the order.
    """
    return {
        "data": {"found": False, "order": None, "error": f"Không tìm thấy đơn hàng #{order_id}."},
        "meta": {"outcome": outcome},
        "trace": steps,
    }


def _anonymous_step() -> dict[str, Any]:
    """Describe a request without a login session.

    Returns:
        Raw trace step.
    """
    return {
        "layer": "backend",
        "tag": "require-session",
        "status": "warning",
        "title": "Chưa đăng nhập",
        "detail": "Chỉ chủ đơn hàng đã đăng nhập mới xem được đơn.",
    }


# @snippet:start
async def list_orders(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """List the orders of the logged-in user ('Đơn hàng của tôi')."""
    _ = payload
    actor = ctx.actor
    if actor is None:
        return {"data": {"orders": [], "count": 0}, "meta": {"outcome": "normal"}, "trace": []}
    # @step:list-orders
    orders = await db.fetch_all(_LIST_SQL, actor.id)
    return {
        "data": {"orders": orders, "count": len(orders)},
        "meta": {"outcome": "normal"},
        "trace": [
            {
                "layer": "database",
                "tag": "list-orders",
                "status": "info",
                "title": "Lấy đơn hàng của người đang đăng nhập",
                "detail": f"{_LIST_SQL} -- $1 = {actor.id} ({actor.username}, từ phiên)",
            },
        ],
    }


async def view_order(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Show one order (VULNERABLE: looked up by order_id only, no ownership check)."""
    # @step:read-order-id
    order_id = _as_int(payload.get("order_id"), 0)
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        return _not_found(order_id, [_anonymous_step()], "normal")

    sql = (
        "SELECT o.id, o.user_id, u.username AS owner, o.status, o.total_amount, "
        "o.shipping_address, o.created_at FROM orders o JOIN users u ON u.id = o.user_id "
        # @step:build-order-query
        "WHERE o.id = $1"
    )
    # @step:fetch-order
    row = await db.fetch_one(sql, order_id)
    steps: list[dict[str, Any]] = [
        {
            "layer": "backend",
            "tag": "read-order-id",
            "status": "info",
            "title": "Đọc order_id từ URL (người dùng kiểm soát)",
            "detail": f"order_id = {order_id}",
        },
        {
            "layer": "backend",
            "tag": "build-order-query",
            "status": "warning",
            "title": "Truy vấn chỉ theo order_id, không kiểm tra chủ sở hữu",
            "detail": f"{sql} -- $1 = {order_id} (phiên: {actor.username} bị bỏ qua)",
        },
    ]
    if row is None:
        steps.append(
            {
                "layer": "database",
                "tag": "fetch-order",
                "status": "info",
                "title": "0 bản ghi",
                "detail": f"Không có đơn hàng #{order_id}.",
            },
        )
        return _not_found(order_id, steps, "normal")

    items = await db.fetch_all(_ITEMS_SQL, order_id)
    order = {key: value for key, value in row.items() if key != "user_id"}
    leaked = row["user_id"] != actor.id
    steps.append(
        {
            "layer": "database",
            "tag": "fetch-order",
            "status": "danger" if leaked else "info",
            "title": "Trả đơn của người khác!" if leaked else "Trả đơn của chính người dùng",
            "detail": (
                f"Đơn #{order_id} của {row['owner']} bị trả cho {actor.username}: "
                f"lộ địa chỉ {row['shipping_address']!r}."
                if leaked
                else f"Đơn #{order_id} của {row['owner']}, {len(items)} sản phẩm."
            ),
        },
    )
    return {
        "data": {"found": True, "order": {**order, "items": items}},
        "meta": {"outcome": "exploited" if leaked else "normal"},
        "trace": steps,
    }


# @snippet:end
