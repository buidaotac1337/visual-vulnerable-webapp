"""Classify changed file paths into the exact quality gates required."""

from typing import Literal

GateName = Literal["hygiene", "docs", "backend", "frontend", "infra"]

_BACKEND_EXACT = frozenset({"pyproject.toml", "uv.lock", ".python-version"})
_INFRA_EXACT = frozenset(
    {"docker-compose.yml", ".dockerignore", ".pre-commit-config.yaml", ".env.example"},
)


def _classify_single_path(normalized: str) -> set[GateName]:
    """Map one repo-relative POSIX path to its impacted quality gates.

    Matches the path filter matrix in .github/workflows/ci.yml (SSOT).

    Args:
        normalized: Forward-slash relative path from repository root.

    Returns:
        Set of GateName values triggered by this path.
    """
    gates: set[GateName] = set()
    if (
        normalized.endswith(".md")
        or normalized.startswith(("docs/", "scripts/"))
        or normalized in {"LICENSE", "pyproject.toml"}
    ):
        gates.add("docs")
    if (
        normalized in _BACKEND_EXACT
        or normalized.startswith(("core/backend/", "scripts/"))
        or (normalized.startswith("labs/") and "/backend/" in normalized)
        or (normalized.startswith("labs/") and normalized.endswith("/meta.json"))
    ):
        gates.add("backend")
    if (
        normalized.startswith(("core/frontend/", "scripts/"))
        or normalized == "pyproject.toml"
        or (normalized.startswith("labs/") and "/frontend/" in normalized)
    ):
        gates.add("frontend")
    if (
        normalized in _INFRA_EXACT
        or normalized.endswith("Dockerfile")
        or normalized.startswith(("core/postgres/", ".github/", "scripts/"))
    ):
        gates.add("infra")
    return gates


def classify_changed_files(paths: list[str]) -> set[GateName]:
    """Determine the minimal set of quality gates for a list of changed paths.

    Args:
        paths: Repository-relative paths reported by git diff/status.

    Returns:
        Set of GateName identifiers that must execute for the change set.
    """
    gates: set[GateName] = {"hygiene"}
    for raw_path in paths:
        normalized = raw_path.strip().replace("\\", "/")
        while normalized.startswith("./"):
            normalized = normalized.removeprefix("./")
        if not normalized:
            continue
        gates.update(_classify_single_path(normalized))
    return gates
