"""Lab 05 (Secure): Mass assignment on the MiniShop profile page.

The request body is validated against ProfileUpdate, a schema that lists the only
field a customer may change (email) and forbids every other key. role and balance
can only be changed by trusted server code, never from a profile form.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_PROFILE_SQL = "SELECT id, username, email, role, balance FROM users WHERE id = $1"
_EMAIL_TAKEN_SQL = "SELECT 1 FROM users WHERE email = $1 AND id <> $2"

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


def _invalid(exc: ValidationError, profile: Profile) -> dict[str, Any]:
    """Explain why the request body does not fit ProfileUpdate.

    Args:
        exc: Pydantic validation error.
        profile: Current, unchanged profile.

    Returns:
        Rejection that names forbidden fields, or the invalid email.
    """
    forbidden = [str(e["loc"][0]) for e in exc.errors() if e["type"] == "extra_forbidden"]
    if forbidden:
        error = f"Không được phép cập nhật trường: {', '.join(forbidden)}."
        step = _step("backend", "profile-schema", "safe", "Từ chối trường ngoài schema", error)
        return _rejected(error, [step], profile, "blocked")
    error = "Email không hợp lệ."
    step = _step("backend", "bind-fields", "info", "Dữ liệu không hợp lệ", str(exc))
    return _rejected(error, [step], profile, "normal")


def _updated(before: Profile, after: Profile, sql: str) -> dict[str, Any]:
    """Build the trace and data of an applied email change.

    Args:
        before: Profile read before the update.
        after: Profile read after the update.
        sql: UPDATE statement that was run.

    Returns:
        Lab execution dictionary.
    """
    steps: Steps = [
        _step(
            "backend",
            "bind-fields",
            "safe",
            "Chỉ nhận các trường khai báo trong ProfileUpdate",
            "email (role, balance và mọi trường khác bị từ chối).",
        ),
        _step(
            "database",
            "update-user",
            "info",
            "Cập nhật email",
            f"{sql} -- email: {before['email']} -> {after['email']}",
        ),
    ]
    return {
        "data": {"updated": True, "profile": after, "error": None},
        "meta": {"outcome": "normal"},
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
class ProfileUpdate(BaseModel):
    """The only fields a customer may change on their own profile."""

    # @step:profile-schema
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def update_profile(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Update the logged-in user's profile (SECURE: allowlisted fields via a schema)."""
    actor = ctx.actor
    # @step:require-session
    if actor is None:
        step = _step("backend", "require-session", "warning", "Chưa đăng nhập", "Cần phiên.")
        return _rejected("Cần đăng nhập để sửa hồ sơ.", [step], None, "normal")
    before = await db.fetch_one(_PROFILE_SQL, actor.id) or {}

    try:
        # @step:bind-fields
        changes = ProfileUpdate.model_validate(payload).model_dump()
    except ValidationError as exc:
        return _invalid(exc, before)

    # @step:check-email
    error = await _email_error(db, changes.get("email"), actor.id)
    if error:
        step = _step("database", "check-email", "info", "Email đã tồn tại", error)
        return _rejected(error, [step], before, "normal")

    sql = "UPDATE users SET email = $1 WHERE id = $2"
    # @step:update-user
    await db.execute(sql, changes["email"], actor.id)
    after = await db.fetch_one(_PROFILE_SQL, actor.id) or {}
    return _updated(before, after, sql)


# @snippet:end
