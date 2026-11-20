"""SSOT configuration loader and shared result types for quality checks."""

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class QualityConfig:
    """Repository-wide quality thresholds loaded from pyproject.toml.

    Attributes:
        max_lines_per_file: Hard maximum allowed lines per source file.
        warn_lines_per_file: Soft threshold emitting an early modularization warning.
        source_roots: Top-level directories scanned for source code metrics.
        source_extensions: File extensions subject to line-length limits.
        exclude_dirs: Directory names skipped during recursive traversal.
        barrel_python_roots: Python package roots enforced to expose __all__ barrels.
        barrel_frontend_dirs: Frontend module directories required to expose index.ts.
    """

    max_lines_per_file: int
    warn_lines_per_file: int
    source_roots: tuple[str, ...]
    source_extensions: tuple[str, ...]
    exclude_dirs: frozenset[str]
    barrel_python_roots: tuple[str, ...]
    barrel_frontend_dirs: tuple[str, ...]


@dataclass(frozen=True)
class CheckResult:
    """Standard outcome object returned by every quality checker.

    Attributes:
        name: Human-readable checker identifier.
        errors: Blocking violations that fail the quality gate.
        warnings: Non-blocking advisories surfaced for early cleanup.
    """

    name: str
    errors: tuple[str, ...] = field(default_factory=tuple)
    warnings: tuple[str, ...] = field(default_factory=tuple)

    @property
    def passed(self) -> bool:
        """Return True when the check recorded zero blocking errors.

        Returns:
            Boolean indicating whether the check succeeded.
        """
        return len(self.errors) == 0


def load_quality_config(repo_root: Path) -> QualityConfig:
    """Load SSOT quality configuration from the root pyproject.toml file.

    Args:
        repo_root: Absolute path to the repository root directory.

    Returns:
        Populated QualityConfig parsed from [tool.vvwa.quality].
    """
    pyproject_path = repo_root / "pyproject.toml"
    with pyproject_path.open("rb") as handle:
        data = tomllib.load(handle)

    raw = data.get("tool", {}).get("vvwa", {}).get("quality", {})
    return QualityConfig(
        max_lines_per_file=int(raw.get("max_lines_per_file", 350)),
        warn_lines_per_file=int(raw.get("warn_lines_per_file", 280)),
        source_roots=tuple(raw.get("source_roots", ["core", "labs", "scripts"])),
        source_extensions=tuple(raw.get("source_extensions", [".py", ".ts", ".tsx"])),
        exclude_dirs=frozenset(raw.get("exclude_dirs", ["node_modules", ".venv", "__pycache__"])),
        barrel_python_roots=tuple(raw.get("barrel_python_roots", [])),
        barrel_frontend_dirs=tuple(raw.get("barrel_frontend_dirs", [])),
    )
