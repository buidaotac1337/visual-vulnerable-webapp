"""Session actor schemas injected into lab handlers that declare a `ctx` parameter (ADR-0005)."""

import re

from pydantic import BaseModel, ConfigDict

ACTOR_USERNAME_PATTERN = re.compile(r"\A[a-z0-9_]{1,32}\Z")


class LabActor(BaseModel):
    """Authenticated MiniShop persona resolved by the engine from the session header.

    Attributes:
        id: Primary key of the user row in minishop.users.
        username: Login name of the persona.
        role: Live role read from the database on every request.
    """

    model_config = ConfigDict(frozen=True)

    id: int
    username: str
    role: str


class LabContext(BaseModel):
    """Trusted per-request context the engine supplies alongside the untrusted payload.

    Attributes:
        actor: Logged-in persona, or None when the request is anonymous.
    """

    model_config = ConfigDict(frozen=True)

    actor: LabActor | None = None
