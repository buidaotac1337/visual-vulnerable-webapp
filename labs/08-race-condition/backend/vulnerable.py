"""Lab 08 (Vulnerable): TOCTOU race condition in MiniShop coupon redemption.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
apply_coupon checks used_count < max_uses on one pool connection, yields across an
async delay window, and increments used_count without a transaction or row lock.
Students patch this file and verify the fix with Test My Fix.
"""

import asyncio
from decimal import Decimal
from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_COUPONS_SQL = "SELECT id, code, discount_percent, max_uses, used_count FROM coupons ORDER BY id"
_COUPON_BY_CODE_SQL = (
    "SELECT id, code, discount_percent, max_uses, used_count FROM coupons WHERE code = $1"
)
_BALANCE_SQL = "SELECT balance FROM users WHERE id = $1"
_INCREMENT_COUPON_SQL = (
    "UPDATE coupons SET used_count = used_count + 1 WHERE id = $1 RETURNING used_count"
)
_CREDIT_BALANCE_SQL = "UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance"
_ORDER_BASE = Decimal("100.00")
_CENT = Decimal("0.01")
_RACE_WINDOW_SECONDS = 0.06

Steps = list[dict[str, Any]]


def _coupon_bonus(discount_percent: int) -> Decimal:
    """Compute cashback dollars for a $100.00 MiniShop order."""
    return (_ORDER_BASE * Decimal(discount_percent) / Decimal(100)).quantize(_CENT)


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one raw trace step matching an # @step:<tag> marker."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _rejected(
    code: str,
    error: str,
    steps: Steps,
    outcome: str = "normal",
) -> dict[str, Any]:
    """Build a uniform response dictionary when no coupon was applied."""
    return {
        "data": {
            "applied": False,
            "code": code,
            "discount_percent": None,
            "bonus": 0.0,
            "used_count": None,
            "max_uses": None,
            "over_limit": False,
            "balance": None,
            "error": error,
        },
        "meta": {"outcome": outcome},
        "trace": steps,
    }


def _applied_result(
    coupon: dict[str, Any],
    new_used_count: int,
    new_balance: float,
    steps: Steps,
) -> dict[str, Any]:
    """Build response and trace step after incrementing coupon usage and balance."""
    code = str(coupon["code"])
    discount_percent = int(coupon["discount_percent"])
    max_uses = int(coupon["max_uses"])
    bonus = float(_coupon_bonus(discount_percent))
    over_limit = new_used_count > max_uses
    if over_limit:
        step = _step(
            "database",
            "consume-coupon",
            "danger",
            "Race condition: vượt giới hạn lượt dùng mã!",
            f"{code}: used_count={new_used_count}/{max_uses}, "
            f"vẫn cộng +${bonus:.2f} -> số dư ${new_balance:.2f}",
        )
    else:
        step = _step(
            "database",
            "consume-coupon",
            "info",
            "Cập nhật lượt dùng và cộng thưởng",
            f"{code}: used_count={new_used_count}/{max_uses}, "
            f"+${bonus:.2f} -> số dư ${new_balance:.2f}",
        )
    return {
        "data": {
            "applied": True,
            "code": code,
            "discount_percent": discount_percent,
            "bonus": bonus,
            "used_count": new_used_count,
            "max_uses": max_uses,
            "over_limit": over_limit,
            "balance": new_balance,
            "error": None,
        },
        "meta": {"outcome": "exploited" if over_limit else "normal"},
        "trace": [*steps, step],
    }


async def load_coupons(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Load available MiniShop coupons and the current session actor's balance."""
    _ = payload
    coupons = await db.fetch_all(_COUPONS_SQL)
    balance = None if ctx.actor is None else await db.fetch_val(_BALANCE_SQL, ctx.actor.id)
    return {
        "data": {"coupons": coupons, "balance": balance},
        "meta": {"outcome": "normal"},
        "trace": [],
    }


async def coupon_status(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Inspect a coupon's current DB usage count and the session actor's balance."""
    code = str(payload.get("code") or "WELCOME10").strip().upper()
    balance = None if ctx.actor is None else await db.fetch_val(_BALANCE_SQL, ctx.actor.id)
    coupon = await db.fetch_one(_COUPON_BY_CODE_SQL, code)
    if coupon is None:
        return {
            "data": {
                "found": False,
                "code": code,
                "used_count": None,
                "max_uses": None,
                "over_limit": False,
                "balance": balance,
            },
            "meta": {"outcome": "normal"},
            "trace": [],
        }
    used_count = int(coupon["used_count"])
    max_uses = int(coupon["max_uses"])
    return {
        "data": {
            "found": True,
            "code": str(coupon["code"]),
            "discount_percent": int(coupon["discount_percent"]),
            "used_count": used_count,
            "max_uses": max_uses,
            "over_limit": used_count > max_uses,
            "balance": balance,
        },
        "meta": {"outcome": "normal"},
        "trace": [],
    }


# @snippet:start
async def apply_coupon(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Apply a discount coupon (VULNERABLE: TOCTOU gap without transaction/FOR UPDATE)."""
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _rejected("", "Cần đăng nhập để áp mã giảm giá.", [step])

    code = str(payload.get("code", "")).strip().upper()
    steps: Steps = []

    # @step:read-coupon
    coupon = await db.fetch_one(
        "SELECT id, code, discount_percent, max_uses, used_count FROM coupons WHERE code = $1",
        code,
    )
    if coupon is None:
        steps.append(_step("database", "read-coupon", "info", f"Không thấy mã '{code}'", code))
        return _rejected(code, f"Mã giảm giá '{code}' không tồn tại.", steps)
    steps.append(
        _step(
            "database",
            "read-coupon",
            "warning",
            "Đọc mã giảm giá KHÔNG khóa transaction",
            f"{code}: used_count={coupon['used_count']}/{coupon['max_uses']}",
        ),
    )

    # @step:check-limit
    if int(coupon["used_count"]) >= int(coupon["max_uses"]):
        detail = f"{code}: {coupon['used_count']}/{coupon['max_uses']} lượt."
        steps.append(_step("backend", "check-limit", "info", "Mã đã hết lượt", detail))
        return _rejected(code, f"Mã '{code}' đã hết lượt sử dụng.", steps, outcome="blocked")
    steps.append(
        _step(
            "backend",
            "check-limit",
            "warning",
            "Kiểm tra giới hạn trên ảnh chụp chưa khóa",
            f"{coupon['used_count']} < {coupon['max_uses']}",
        ),
    )

    # @step:race-window
    await asyncio.sleep(_RACE_WINDOW_SECONDS)
    steps.append(
        _step(
            "backend",
            "race-window",
            "warning",
            "Cửa sổ TOCTOU (60ms trước khi ghi DB)",
            "Các request đồng thời khác cùng vượt qua bước check-limit tại đây.",
        ),
    )

    # @step:consume-coupon
    new_used_count = int(await db.fetch_val(_INCREMENT_COUPON_SQL, coupon["id"]))
    bonus = _coupon_bonus(int(coupon["discount_percent"]))
    new_balance = float(await db.fetch_val(_CREDIT_BALANCE_SQL, bonus, actor.id))
    return _applied_result(coupon, new_used_count, new_balance, steps)


# @snippet:end
