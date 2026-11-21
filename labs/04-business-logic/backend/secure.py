"""Lab 04 (Secure): Business logic flaw in the MiniShop checkout.

The browser only chooses what to buy and how many. Quantities are validated
(gt=0) and every price is read again from the database, never from the request.
"""

from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_PRODUCTS_SQL = "SELECT id, name, price, stock FROM products ORDER BY id"
_BALANCE_SQL = "SELECT balance FROM users WHERE id = $1"
_CATALOG_SQL = "SELECT id, name, price, stock FROM products WHERE id = ANY($1::int[])"
_CHARGE_SQL = (
    "UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance"
)
_ORDER_SQL = (
    "INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'paid') RETURNING id"
)
_ITEM_SQL = (
    "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)"
)
_CENT = Decimal("0.01")

Catalog = dict[int, dict[str, Any]]
Steps = list[dict[str, Any]]


def _money(value: object) -> Decimal:
    """Convert a price (float, int, or string) to a Decimal rounded to cents."""
    return Decimal(str(value)).quantize(_CENT)


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one raw trace step for the @step tag of the highlighted line."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _rejected(error: str, steps: Steps, outcome: str = "normal") -> dict[str, Any]:
    """Build the response for a checkout that placed no order.

    Args:
        error: Reason shown to the user.
        steps: Trace steps collected so far.
        outcome: Pedagogical outcome label.

    Returns:
        Lab execution dictionary.
    """
    return {
        "data": {"placed": False, "order": None, "balance": None, "error": error},
        "meta": {"outcome": outcome},
        "trace": steps,
    }


def _invalid_cart(exc: ValidationError) -> str:
    """Summarize the first validation error of the request body.

    Args:
        exc: Pydantic validation error.

    Returns:
        Human-readable message naming the offending field.
    """
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"])
    return f"Giỏ hàng không hợp lệ ({field}): {first['msg']}"


async def _load_catalog(db: LabDatabaseProtocol, items: list["CartItem"]) -> Catalog:
    """Load the products referenced by the cart.

    Args:
        db: Restricted lab database adapter.
        items: Cart lines.

    Returns:
        Products keyed by id.
    """
    rows = await db.fetch_all(_CATALOG_SQL, [item.product_id for item in items])
    return {int(row["id"]): row for row in rows}


def _catalog_error(catalog: Catalog, items: list["CartItem"]) -> str:
    """Check that every product exists and has enough stock.

    Args:
        catalog: Products keyed by id.
        items: Cart lines.

    Returns:
        Error message, or '' when the cart matches the catalog.
    """
    for item in items:
        product = catalog.get(item.product_id)
        if product is None:
            return f"Sản phẩm id={item.product_id} không tồn tại."
        if item.quantity > int(product["stock"]):
            return f"{product['name']} chỉ còn {product['stock']} sản phẩm trong kho."
    return ""


def _describe(lines: list[tuple["CartItem", Decimal]], catalog: Catalog) -> str:
    """Describe each cart line next to its catalog price.

    Args:
        lines: Cart lines with the unit price used for the total.
        catalog: Products keyed by id.

    Returns:
        One-line summary.
    """
    return "; ".join(
        f"{catalog[item.product_id]['name']} x {item.quantity} @ ${price} "
        f"(niêm yết ${_money(catalog[item.product_id]['price'])})"
        for item, price in lines
    )


def _sent_price(raw_items: object, index: int) -> Decimal | None:
    """Read the price the browser sent for one cart line, if any.

    Args:
        raw_items: Untrusted 'items' value from the request body.
        index: Cart line position.

    Returns:
        Sent price, or None when absent or not a number.
    """
    if not isinstance(raw_items, list) or index >= len(raw_items):
        return None
    raw = raw_items[index]
    if not isinstance(raw, dict) or raw.get("price") is None:
        return None
    try:
        return _money(raw["price"])
    except (InvalidOperation, ValueError):
        return None


def _placed(
    order_id: int,
    lines: list[tuple["CartItem", Decimal]],
    catalog: Catalog,
    balance: float,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Build the trace and data of a placed order, noting client prices that were ignored.

    Args:
        order_id: New order id.
        lines: Cart lines with the database unit price.
        catalog: Products keyed by id.
        balance: Balance left after the charge.
        payload: Untrusted request body (only used to show ignored prices).

    Returns:
        Lab execution dictionary.
    """
    total = sum((price * item.quantity for item, price in lines), Decimal(0))
    ignored = [
        f"{catalog[item.product_id]['name']}: client gửi ${sent}, DB ${price}"
        for index, (item, price) in enumerate(lines)
        if (sent := _sent_price(payload.get("items"), index)) is not None and sent != price
    ]
    steps: Steps = [
        _step(
            "backend",
            "cart-model",
            "safe",
            "Chỉ nhận product_id và quantity > 0 từ trình duyệt",
            _describe(lines, catalog),
        ),
        _step(
            "backend",
            "price-cart",
            "safe" if ignored else "info",
            f"Tổng tiền tính từ giá trong DB: ${total}",
            f"Bỏ qua giá client gửi: {'; '.join(ignored)}." if ignored else "Giá client bị bỏ qua.",
        ),
        _step(
            "database",
            "charge-balance",
            "info",
            f"Trừ ${total} khỏi số dư",
            f"{_CHARGE_SQL} -- số dư còn ${balance:.2f}",
        ),
        _step("database", "insert-order", "info", f"Tạo đơn #{order_id}", "status = 'paid'"),
    ]
    items = [
        {
            "product_id": item.product_id,
            "name": catalog[item.product_id]["name"],
            "quantity": item.quantity,
            "unit_price": float(price),
        }
        for item, price in lines
    ]
    order = {"id": order_id, "total_amount": float(total), "items": items}
    return {
        "data": {"placed": True, "order": order, "balance": balance, "error": None},
        "meta": {"outcome": "blocked" if ignored else "normal"},
        "trace": steps,
    }


async def load_shop(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Load the product catalog and the logged-in user's balance."""
    _ = payload
    products = await db.fetch_all(_PRODUCTS_SQL)
    balance = None if ctx.actor is None else await db.fetch_val(_BALANCE_SQL, ctx.actor.id)
    data = {"products": products, "balance": balance}
    return {"data": data, "meta": {"outcome": "normal"}, "trace": []}


# @snippet:start
class CartItem(BaseModel):
    """One cart line as sent by the browser: what to buy and how many, never the price."""

    product_id: int
    # @step:cart-model
    quantity: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    """Checkout request body."""

    items: list[CartItem] = Field(min_length=1, max_length=10)


async def checkout(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Place an order (SECURE: validated quantities, prices read from the database)."""
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _rejected("Cần đăng nhập để thanh toán.", [step])
    try:
        # @step:parse-cart
        cart = CheckoutRequest.model_validate(payload)
    except ValidationError as exc:
        step = _step("backend", "parse-cart", "safe", "Từ chối giỏ hàng không hợp lệ", str(exc))
        return _rejected(_invalid_cart(exc), [step], "blocked")

    # @step:load-products
    catalog = await _load_catalog(db, cart.items)
    error = _catalog_error(catalog, cart.items)
    if error:
        return _rejected(error, [_step("database", "load-products", "warning", error, "")])

    # @step:price-cart
    lines = [(item, _money(catalog[item.product_id]["price"])) for item in cart.items]
    total = sum((price * item.quantity for item, price in lines), Decimal(0))
    # @step:charge-balance
    balance = await db.fetch_val(_CHARGE_SQL, total, actor.id)
    if balance is None:
        step = _step("database", "charge-balance", "info", "Số dư không đủ", f"Cần ${total}.")
        return _rejected(f"Số dư không đủ để thanh toán ${total}.", [step])

    # @step:insert-order
    order_id = await db.fetch_val(_ORDER_SQL, actor.id, total)
    for item, price in lines:
        await db.execute(_ITEM_SQL, order_id, item.product_id, item.quantity, price)
    return _placed(order_id, lines, catalog, balance, payload)


# @snippet:end
