"""Enforce maximum line-count limits across repository source files."""

from pathlib import Path

from scripts.quality.config import CheckResult, QualityConfig


def _iter_source_files(repo_root: Path, config: QualityConfig) -> list[Path]:
    """Collect tracked source files subject to line-count limits.

    Args:
        repo_root: Repository root directory.
        config: Loaded quality configuration.

    Returns:
        Sorted list of matching source file paths.
    """
    matched: list[Path] = []
    for root_name in config.source_roots:
        root_path = repo_root / root_name
        if not root_path.exists():
            continue
        for candidate in root_path.rglob("*"):
            if not candidate.is_file():
                continue
            rel_parts = candidate.relative_to(repo_root).parts
            if any(part in config.exclude_dirs for part in rel_parts):
                continue
            if candidate.suffix in config.source_extensions:
                matched.append(candidate)
    return sorted(matched)


def check_file_limits(repo_root: Path, config: QualityConfig) -> CheckResult:
    """Validate that no source file exceeds the configured line limit.

    Args:
        repo_root: Repository root directory.
        config: Quality configuration containing line thresholds.

    Returns:
        CheckResult listing any files exceeding max_lines_per_file or warn_lines_per_file.
    """
    errors: list[str] = []
    warnings: list[str] = []

    for file_path in _iter_source_files(repo_root, config):
        line_count = len(file_path.read_text(encoding="utf-8").splitlines())
        rel_path = file_path.relative_to(repo_root).as_posix()
        if line_count > config.max_lines_per_file:
            errors.append(
                f"{rel_path}: {line_count} lines exceeds hard limit of "
                f"{config.max_lines_per_file} lines.",
            )
        elif line_count > config.warn_lines_per_file:
            warnings.append(
                f"{rel_path}: {line_count} lines approaches limit "
                f"({config.max_lines_per_file}); consider splitting responsibilities.",
            )

    return CheckResult(name="file-limits", errors=tuple(errors), warnings=tuple(warnings))
