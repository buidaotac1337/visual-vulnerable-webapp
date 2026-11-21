"""Lab 05 (Vulnerable): Mass assignment on the MiniShop profile page.

INTENTIONALLY VULNERABLE FOR EDUCATIONAL USE ONLY.
update_profile copies every key of the request body that matches a column of the
User model, so a customer can send role or balance next to email and the database
stores them. Students patch this file and verify the fix with Test My Fix.
"""

from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_PROFILE_SQL = "SELECT id, username, email, role, balance FROM users WHERE id = $1"
_EMAIL_TAKEN_SQL = "SELECT 1 FROM users WHERE email = $1 AND id <> $2"
_PRIVILEGED = ("role", "balance")

# Writable columns of the User model and their SQL types, as an ORM would expose them.
_USER_COLUMNS = {"email": "varchar", "role": "varchar", "balance": "numeric"}

Profile = dict[str, Any]
Steps = list[dict[str, Any]]


def _step(layer: str, tag: str, status: str, title: str, detail: str) -> dict[str, Any]:
    """Build one raw trace step for the @step tag of the highlighted line."""
    return {"layer": layer, "tag": tag, "status": status, "title": title, "detail": detail}


def _rejected(error: str, steps: Steps, profile: Profile | None, outcome: str) -> dict[str, Any]:
    """Build the response for an update that changed nothing, with the current profile."""
    return {
        "data": {"updated": False, "profile": profile, "error": error},
        "meta": {"outcome": outcome},
        "trace": steps,
    }


def _update_sql(changes: dict[str, Any]) -> tuple[str, list[str]]:
    """Build an UPDATE for the given columns; the session user id is the last parameter.

    Args:
        changes: Column name to new value (names come from _USER_COLUMNS only).

    Returns:
        SQL text and its text parameters.
    """
    assignments = [
        f"{column} = CAST(${index}::text AS {_USER_COLUMNS[column]})"
        for index, column in enumerate(changes, start=1)
    ]
    sql = f"UPDATE users SET {', '.join(assignments)} WHERE id = ${len(changes) + 1}"
    return sql, [str(value) for value in changes.values()]


async def _email_error(db: LabDatabaseProtocol, email: object, user_id: int) -> str:
    """Reject an email that already belongs to another account.

    Args:
        db: Restricted lab database adapter.
        email: New email, or None when the request does not change it.
        user_id: Session user id.

    Returns:
        Error message, or '' when the email can be used.
    """
    if email is None:
        return ""
    if await db.fetch_val(_EMAIL_TAKEN_SQL, str(email), user_id) is not None:
        return f"Email {email} đã được tài khoản khác sử dụng."
    return ""


def _diff(before: Profile, after: Profile) -> list[str]:
    """List the profile fields whose value changed.

    Args:
        before: Profile read before the update.
        after: Profile read after the update.

    Returns:
        Lines such as 'role: customer -> admin'.
    """
    return [
        f"{key}: {before[key]} -> {after[key]}"
        for key in ("email", "role", "balance")
        if before[key] != after[key]
    ]


def _updated(before: Profile, after: Profile, changes: dict[str, Any]) -> dict[str, Any]:
    """Build the trace and data of an applied update, flagging privileged fields.

    Args:
        before: Profile read before the update.
        after: Profile read after the update.
        changes: Columns written from the request body.

    Returns:
        Lab execution dictionary.
    """
    escalated = [key for key in _PRIVILEGED if before[key] != after[key]]
    steps: Steps = [
        _step(
            "backend",
            "bind-fields",
            "danger" if escalated else "warning",
            f"Gán mọi trường khớp cột User: {', '.join(changes)}",
            "Không có danh sách trường được phép: request quyết định cột nào bị ghi.",
        ),
        _step(
            "database",
            "update-user",
            "danger" if escalated else "info",
            f"Tự cập nhật {', '.join(escalated)}!" if escalated else "Cập nhật hồ sơ",
            f"{_update_sql(changes)[0]} -- " + ("; ".join(_diff(before, after)) or "không đổi"),
        ),
    ]
    return {
        "data": {"updated": True, "profile": after, "error": None},
        "meta": {"outcome": "exploited" if escalated else "normal"},
        "trace": steps,
    }


async def load_profile(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Load the profile of the logged-in user ('Hồ sơ của tôi')."""
    _ = payload
    profile = None if ctx.actor is None else await db.fetch_one(_PROFILE_SQL, ctx.actor.id)
    return {"data": {"profile": profile}, "meta": {"outcome": "normal"}, "trace": []}


# @snippet:start
async def update_profile(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Update the logged-in user's profile (VULNERABLE: binds every matching column)."""
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _rejected("Cần đăng nhập để sửa hồ sơ.", [step], None, "normal")
    before = await db.fetch_one(_PROFILE_SQL, actor.id) or {}

    # @step:bind-fields
    changes = {key: value for key, value in payload.items() if key in _USER_COLUMNS}
    if not changes:
        step = _step("backend", "bind-fields", "info", "Không có trường nào để cập nhật", "")
        return _rejected("Không có trường nào để cập nhật.", [step], before, "normal")

    # @step:check-email
    error = await _email_error(db, changes.get("email"), actor.id)
    if error:
        step = _step("database", "check-email", "info", "Email đã tồn tại", error)
        return _rejected(error, [step], before, "normal")

    sql, args = _update_sql(changes)
    # @step:update-user
    await db.execute(sql, *args, actor.id)
    after = await db.fetch_one(_PROFILE_SQL, actor.id) or {}
    return _updated(before, after, changes)


# @snippet:end
