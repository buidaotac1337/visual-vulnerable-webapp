"""Lab 01 (Secure): SQL Injection defense using asyncpg Parameterized Queries."""

from typing import Any

from app.db import LabDatabaseProtocol


def _looks_like_sqli(text: str) -> bool:
    """Check whether user input contains common SQL injection tokens for pedagogical trace.

    Args:
        text: User-supplied input string.

    Returns:
        True when input includes SQL metacharacters such as quotes or comments.
    """
    lowered = text.lower()
    return "'" in lowered or "--" in lowered or "union " in lowered


def _build_login_result(
    username: str,
    password: str,
    row: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the unified safe login response and live trace steps.

    Args:
        username: Submitted username parameter.
        password: Submitted password parameter.
        row: Returned user row or None.

    Returns:
        Lab execution dictionary with data, meta, and safe trace.
    """
    blocked = row is None and (_looks_like_sqli(username) or _looks_like_sqli(password))
    return {
        "data": {"logged_in": row is not None, "user": row},
        "meta": {"outcome": "blocked" if blocked else "normal"},
        "trace": [
            {
                "layer": "backend",
                "tag": "build-login-query",
                "status": "safe",
                "title": "Parameterized Query ($1, $2)",
                "detail": "Tách biệt hoàn toàn cấu trúc SQL khỏi dữ liệu bằng placeholder $1, $2.",
            },
            {
                "layer": "database",
                "tag": "exec-login-query",
                "status": "safe" if blocked else "info",
                "title": "PostgreSQL bind tham số an toàn",
                "detail": (
                    f"Đã chặn SQLi! Đối chiếu chuỗi literal username={username!r} -> 0 bản ghi."
                    if blocked
                    else (
                        f"Đăng nhập hợp lệ: {row['username']} (role={row['role']})."
                        if row
                        else f"Không tìm thấy tài khoản khớp username={username!r}."
                    )
                ),
            },
        ],
    }


def _build_search_result(
    keyword: str,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the unified safe product search response and live trace steps.

    Args:
        keyword: Submitted search keyword parameter.
        rows: Returned product rows.

    Returns:
        Lab execution dictionary with data, meta, and safe trace.
    """
    blocked = len(rows) == 0 and _looks_like_sqli(keyword)
    return {
        "data": {"products": rows, "count": len(rows)},
        "meta": {"outcome": "blocked" if blocked else "normal"},
        "trace": [
            {
                "layer": "backend",
                "tag": "build-search-query",
                "status": "safe",
                "title": "Parameterized ILIKE ($1)",
                "detail": "Truyền mẫu tìm kiếm qua tham số $1 thay vì nối chuỗi vào câu lệnh SQL.",
            },
            {
                "layer": "database",
                "tag": "exec-search-query",
                "status": "safe" if blocked else "info",
                "title": "PostgreSQL bind mẫu ILIKE an toàn",
                "detail": (
                    f"Đã chặn UNION/SQLi! Tìm chuỗi literal {keyword!r} -> 0 kết quả."
                    if blocked
                    else f"Tìm thấy {len(rows)} sản phẩm khớp từ khóa {keyword!r}."
                ),
            },
        ],
    }


# @snippet:start
async def login(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Authenticate a MiniShop user (SECURE: asyncpg parameterized placeholders)."""
    username = str(payload.get("username", ""))
    password = str(payload.get("password", ""))

    # @step:build-login-query
    sql = (
        "SELECT id, username, email, role, balance FROM users "
        "WHERE username = $1 AND password_hash = $2"
    )

    # @step:exec-login-query
    row = await db.fetch_one(sql, username, password)

    return _build_login_result(username, password, row)


async def search_products(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Search MiniShop products (SECURE: asyncpg parameterized ILIKE)."""
    keyword = str(payload.get("keyword", ""))

    # @step:build-search-query
    sql = "SELECT id, name, description, price, stock FROM products WHERE name ILIKE $1"

    # @step:exec-search-query
    rows = await db.fetch_all(sql, f"%{keyword}%")

    return _build_search_result(keyword, rows)


# @snippet:end
