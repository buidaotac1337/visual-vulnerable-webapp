"""Engine-side resolution of the simulated login session (ADR-0005).

The `X-VVWA-Actor` header plays the role of an authenticated session cookie:
it is the trusted channel, while the JSON payload remains attacker-controlled.
"""

from typing import Any

from app.core import InvalidActorError
from app.db import LabDatabaseProtocol
from app.schemas import ACTOR_USERNAME_PATTERN, LabActor, LabContext

ACTOR_HEADER = "X-VVWA-Actor"
ENGINE_TAG_PREFIX = "engine-"
SESSION_TRACE_TAG = "engine-session"

_ACTOR_LOOKUP_SQL = "SELECT id, username, role FROM users WHERE username = $1"


def normalize_actor_username(raw: str | None) -> str | None:
    """Validate the session header value without touching the database.

    Args:
        raw: Header value, or None when the header was not sent.

    Returns:
        The username, or None for an anonymous request (missing or blank header).

    Raises:
        InvalidActorError: If the value is not a safe lowercase username.
    """
    if raw is None or not raw.strip():
        return None
    if not ACTOR_USERNAME_PATTERN.match(raw):
        msg = f"Invalid {ACTOR_HEADER} value {raw!r}; expected a lowercase seed username."
        raise InvalidActorError(msg)
    return raw


async def resolve_lab_context(db: LabDatabaseProtocol, username: str | None) -> LabContext:
    """Build the trusted LabContext by looking the persona up in minishop.users.

    The role is read live on every call so privilege changes made by a lab
    (for example Mass Assignment) take effect on the very next request.

    Args:
        db: Restricted lab_app_user database adapter.
        username: Persona name from the session header, or None if anonymous.

    Returns:
        LabContext carrying the resolved actor, or an anonymous context.

    Raises:
        InvalidActorError: If the username is malformed or no such user exists.
    """
    safe_name = normalize_actor_username(username)
    if safe_name is None:
        return LabContext()
    row = await db.fetch_one(_ACTOR_LOOKUP_SQL, safe_name)
    if row is None:
        msg = f"Unknown actor '{safe_name}'; press Reset DB if the seed user was removed."
        raise InvalidActorError(msg)
    return LabContext(actor=LabActor.model_validate(row))


def build_session_trace_step(ctx: LabContext) -> dict[str, Any]:
    """Describe which identity the engine attached to this request.

    Args:
        ctx: Context passed to the lab handler.

    Returns:
        Raw trace step dict prepended before the handler's own steps.
    """
    actor = ctx.actor
    detail = (
        f"{actor.username} (id={actor.id}, role={actor.role}) — lấy từ header {ACTOR_HEADER}, "
        "không phải từ payload."
        if actor
        else "Ẩn danh: không có phiên đăng nhập."
    )
    return {
        "layer": "backend",
        "tag": SESSION_TRACE_TAG,
        "status": "info",
        "title": "Phiên đăng nhập (engine cấp)",
        "detail": detail,
    }
