"""Lab 01 (Vulnerable): SQL Injection in MiniShop login and product search.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
Students edit this file directly with Hot Reload and verify fixes via Test My Fix.
"""

from typing import Any

import asyncpg

from app.db import LabDatabaseProtocol

_PRODUCTS_SQL = "SELECT id, name FROM products ORDER BY id"


async def _is_login_bypass(
    db: LabDatabaseProtocol,
    username: str,
    password: str,
    row: dict[str, Any] | None,
) -> bool:
    """Check whether a returned login row bypassed real username/password verification.

    Args:
        db: Database adapter used for ground-truth parameterized comparison.
        username: Raw username supplied in the request payload.
        password: Raw password supplied in the request payload.
        row: Row returned by the vulnerable query, or None.

    Returns:
        True when a user was authenticated without matching real credentials.
    """
    if row is None:
        return False
    exact = await db.fetch_one(
        "SELECT id FROM users WHERE username = $1 AND password_hash = $2",
        username,
        password,
    )
    return exact is None


def _is_search_exploited(keyword: str, rows: list[dict[str, Any]]) -> bool:
    """Detect whether product search returned injected rows or tautology bypass.

    Args:
        keyword: Raw search keyword supplied by the user.
        rows: Matching rows returned by PostgreSQL.

    Returns:
        True when SQL injection altered the expected product search results.
    """
    if not rows:
        return False
    has_sqli_syntax = "'" in keyword or "--" in keyword
    has_leaked_user = any(":" in str(row.get("description", "")) for row in rows)
    return has_leaked_user or has_sqli_syntax


def _sql_error_response(
    tag: str,
    sql: str,
    exc: asyncpg.PostgresError,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Return a pedagogical trace when raw SQL injection breaks PostgreSQL syntax.

    Args:
        tag: Step tag corresponding to the failed query execution.
        sql: Interpolated SQL statement sent to PostgreSQL.
        exc: Raised asyncpg PostgresError.
        data: Domain fallback data dictionary.

    Returns:
        Structured lab response dictionary showing the database syntax error.
    """
    return {
        "data": {**data, "sql_error": str(exc)},
        "meta": {"outcome": "error"},
        "trace": [
            {
                "layer": "backend",
                "tag": tag.replace("exec-", "build-"),
                "status": "warning",
                "title": "Nối chuỗi f-string tạo cú pháp SQL lỗi",
                "detail": f"SQL thực tế: {sql}",
            },
            {
                "layer": "database",
                "tag": tag,
                "status": "danger",
                "title": "PostgreSQL báo lỗi cú pháp (Error-based SQLi)",
                "detail": f"PostgresError: {exc}",
            },
        ],
    }


def _build_login_result(
    sql: str,
    username: str,
    password: str,
    row: dict[str, Any] | None,
    *,
    exploited: bool,
) -> dict[str, Any]:
    """Build the unified login response and live trace steps.

    Args:
        sql: Executed SQL query text.
        username: Raw username input.
        password: Raw password input.
        row: Returned user row or None.
        exploited: Whether authentication bypassed real credentials.

    Returns:
        Lab execution dictionary with data, meta, and trace.
    """
    has_quote = "'" in username or "'" in password
    return {
        "data": {"logged_in": row is not None, "user": row},
        "meta": {"outcome": "exploited" if exploited else "normal"},
        "trace": [
            {
                "layer": "backend",
                "tag": "build-login-query",
                "status": "danger" if exploited or has_quote else "warning",
                "title": "Nối chuỗi trực tiếp bằng f-string",
                "detail": f"SQL thực tế: {sql}",
            },
            {
                "layer": "database",
                "tag": "exec-login-query",
                "status": "danger" if exploited else "info",
                "title": "PostgreSQL thực thi câu lệnh SQL thô",
                "detail": (
                    f"Bypass thành công! Trả về user '{row['username']}' (role={row['role']})."
                    if exploited and row
                    else (
                        f"Đăng nhập hợp lệ: {row['username']} (role={row['role']})."
                        if row
                        else "Không tìm thấy tài khoản khớp."
                    )
                ),
            },
        ],
    }


async def _leaked_rows(db: LabDatabaseProtocol, rows: list[dict[str, Any]]) -> list[int]:
    """Return the indexes of returned rows that are not real products (pulled in by SQLi).

    Args:
        db: Restricted lab database adapter.
        rows: Rows returned by the search query.

    Returns:
        Row indexes the UI should flag as leaked data.
    """
    real = {(p["id"], p["name"]) for p in await db.fetch_all(_PRODUCTS_SQL)}
    return [i for i, row in enumerate(rows) if (row.get("id"), row.get("name")) not in real]


async def _build_search_result(
    db: LabDatabaseProtocol,
    sql: str,
    keyword: str,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the unified product search response and live trace steps.

    Args:
        db: Restricted lab database adapter (used to tell real products from leaked rows).
        sql: Executed SQL query text.
        keyword: Raw search keyword input.
        rows: Returned database rows.

    Returns:
        Lab execution dictionary with data, meta, and trace.
    """
    leaked = await _leaked_rows(db, rows)
    exploited = bool(leaked) or _is_search_exploited(keyword, rows)
    return {
        "data": {"products": rows, "count": len(rows), "leaked_rows": leaked},
        "meta": {"outcome": "exploited" if exploited else "normal"},
        "trace": [
            {
                "layer": "backend",
                "tag": "build-search-query",
                "status": "danger" if exploited or "'" in keyword else "warning",
                "title": "Nối chuỗi keyword trực tiếp vào ILIKE",
                "detail": f"SQL thực tế: {sql}",
            },
            {
                "layer": "database",
                "tag": "exec-search-query",
                "status": "danger" if exploited else "info",
                "title": "PostgreSQL thực thi truy vấn tìm kiếm",
                "detail": (
                    f"Lộ dữ liệu! Trả về {len(rows)} bản ghi (bao gồm dữ liệu tiêm từ UNION/SQLi)."
                    if exploited
                    else f"Tìm thấy {len(rows)} sản phẩm khớp từ khóa {keyword!r}."
                ),
            },
        ],
    }


# @snippet:start
async def login(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Authenticate a MiniShop user (VULNERABLE: raw f-string SQL concatenation)."""
    username = str(payload.get("username", ""))
    password = str(payload.get("password", ""))

    # @step:build-login-query
    sql = (
        "SELECT id, username, email, role, balance FROM users "
        f"WHERE username = '{username}' AND password_hash = '{password}'"
    )

    try:
        # @step:exec-login-query
        row = await db.fetch_one(sql)
    except asyncpg.PostgresError as exc:
        return _sql_error_response("exec-login-query", sql, exc, {"logged_in": False, "user": None})

    exploited = await _is_login_bypass(db, username, password, row)
    return _build_login_result(sql, username, password, row, exploited=exploited)


async def search_products(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Search MiniShop products (VULNERABLE: raw f-string ILIKE concatenation)."""
    keyword = str(payload.get("keyword", ""))

    # @step:build-search-query
    sql = f"SELECT id, name, description, price, stock FROM products WHERE name ILIKE '%{keyword}%'"

    try:
        # @step:exec-search-query
        rows = await db.fetch_all(sql)
    except asyncpg.PostgresError as exc:
        return _sql_error_response("exec-search-query", sql, exc, {"products": [], "count": 0})

    return await _build_search_result(db, sql, keyword, rows)


# @snippet:end
