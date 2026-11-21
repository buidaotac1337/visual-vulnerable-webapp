"""Verify Python and TypeScript barrel exports and module import boundaries."""

from pathlib import Path

from scripts.quality.config import CheckResult, QualityConfig
from scripts.quality.python_barrels import (
    MIN_SUBPKG_IMPORT_DEPTH,
    check_file_imports,
    find_python_packages,
    has_dunder_all,
    is_excluded_rel,
    root_to_package_prefix,
)


def _check_python_barrel_files(repo_root: Path, config: QualityConfig) -> list[str]:
    """Verify every Python package root contains __init__.py with __all__.

    Args:
        repo_root: Repository root directory.
        config: Loaded quality configuration.

    Returns:
        List of missing barrel or missing __all__ error messages.
    """
    errors: list[str] = []
    for rel_root in config.barrel_python_roots:
        for pkg_dir in find_python_packages(
            repo_root / rel_root,
            repo_root,
            config.exclude_dirs,
        ):
            init_file = pkg_dir / "__init__.py"
            rel_pkg = pkg_dir.relative_to(repo_root).as_posix()
            if not init_file.exists():
                errors.append(f"{rel_pkg}: missing barrel file '__init__.py'.")
            elif not has_dunder_all(init_file):
                errors.append(f"{rel_pkg}/__init__.py: missing explicit '__all__' export list.")
    return errors


def _check_python_import_boundaries(repo_root: Path, config: QualityConfig) -> list[str]:
    """Scan Python source files for imports bypassing sibling package barrels.

    Args:
        repo_root: Repository root directory.
        config: Loaded quality configuration.

    Returns:
        List of import boundary violation messages.
    """
    prefixes = tuple(root_to_package_prefix(root) for root in config.barrel_python_roots)
    if not prefixes:
        return []

    scan_roots = {
        (repo_root / rel_root).parent
        if len(Path(rel_root).parts) == MIN_SUBPKG_IMPORT_DEPTH
        else (repo_root / rel_root)
        for rel_root in config.barrel_python_roots
    }

    errors: list[str] = []
    for scan_root in sorted(scan_roots):
        if not scan_root.exists():
            continue
        for py_file in sorted(scan_root.rglob("*.py")):
            if not is_excluded_rel(py_file, repo_root, config.exclude_dirs):
                errors.extend(check_file_imports(py_file, repo_root, prefixes))
    return errors


def _check_frontend_barrels(repo_root: Path, config: QualityConfig) -> list[str]:
    """Verify frontend module directories and nested sub-modules expose index.ts.

    Args:
        repo_root: Repository root directory.
        config: Loaded quality configuration.

    Returns:
        List of missing TypeScript barrel errors.
    """
    errors: list[str] = []
    for rel_fe_dir in config.barrel_frontend_dirs:
        fe_dir = repo_root / rel_fe_dir
        if not fe_dir.exists():
            continue
        ts_dirs: set[Path] = {fe_dir}
        for ts_file in fe_dir.rglob("*.ts*"):
            if ts_file.suffix not in {".ts", ".tsx"}:
                continue
            rel_parts = ts_file.relative_to(repo_root).parts
            if any(part in config.exclude_dirs or part == "__tests__" for part in rel_parts):
                continue
            ts_dirs.add(ts_file.parent)
        for mod_dir in sorted(ts_dirs):
            if not ((mod_dir / "index.ts").exists() or (mod_dir / "index.tsx").exists()):
                rel_mod = mod_dir.relative_to(repo_root).as_posix()
                errors.append(f"{rel_mod}: missing TypeScript barrel file 'index.ts'.")
    return errors


def check_barrels(repo_root: Path, config: QualityConfig) -> CheckResult:
    """Verify barrel exports and import boundaries across Python and Frontend modules.

    Args:
        repo_root: Repository root directory.
        config: Quality configuration defining barrel roots.

    Returns:
        CheckResult summarizing missing barrels or illegal deep imports.
    """
    errors = [
        *_check_python_barrel_files(repo_root, config),
        *_check_python_import_boundaries(repo_root, config),
        *_check_frontend_barrels(repo_root, config),
    ]
    return CheckResult(name="barrel-imports", errors=tuple(errors))
