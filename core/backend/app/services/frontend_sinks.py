"""Discovery of the optional frontend sink pair (vulnerable.tsx + secure.tsx, ADR-0006)."""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

FRONTEND_VULNERABLE_FILE = "vulnerable.tsx"
FRONTEND_SECURE_FILE = "secure.tsx"

SinkPairStatus = Literal["pair", "none", "partial"]


@dataclass(frozen=True)
class FrontendSinkPair:
    """Paths of a complete frontend sink pair.

    Attributes:
        vulnerable: Path to frontend/vulnerable.tsx (the file students patch).
        secure: Path to frontend/secure.tsx (the reference safety pattern).
    """

    vulnerable: Path
    secure: Path


def _sink_paths(lab_dir: Path) -> FrontendSinkPair:
    """Return the expected sink pair locations inside a lab directory.

    Args:
        lab_dir: Resolved labs/<id> directory.

    Returns:
        FrontendSinkPair with both candidate paths (they may not exist).
    """
    frontend_dir = lab_dir / "frontend"
    return FrontendSinkPair(
        vulnerable=frontend_dir / FRONTEND_VULNERABLE_FILE,
        secure=frontend_dir / FRONTEND_SECURE_FILE,
    )


def frontend_sink_pair_status(lab_dir: Path) -> SinkPairStatus:
    """Classify whether a lab has both, neither, or only one frontend sink file.

    Args:
        lab_dir: Resolved labs/<id> directory.

    Returns:
        'pair' when both exist, 'none' when neither exists, otherwise 'partial'.
    """
    paths = _sink_paths(lab_dir)
    present = [paths.vulnerable.is_file(), paths.secure.is_file()]
    if all(present):
        return "pair"
    return "partial" if any(present) else "none"


def find_frontend_sink_pair(lab_dir: Path) -> FrontendSinkPair | None:
    """Return the sink pair only when both files exist; a lone file is ignored.

    Args:
        lab_dir: Resolved labs/<id> directory.

    Returns:
        FrontendSinkPair, or None when the lab has no complete pair.
    """
    if frontend_sink_pair_status(lab_dir) != "pair":
        return None
    return _sink_paths(lab_dir)
