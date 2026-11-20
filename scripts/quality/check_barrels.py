"""Verify Python and TypeScript barrel exports and module import boundaries."""

import ast
from pathlib import Path

from scripts.quality.config import CheckResult, QualityConfig

_BACKEND_PREFIX_PARTS = ("core", "backend")
_MIN_BACKEND_PATH_DEPTH = 3
_MIN_SUBPKG_IMPORT_DEPTH = 2


def _has_dunder_all(init_file: Path) -> bool:
    """Check whether a Python __init__.py explicitly defines __all__.

    Args:
        init_file: Path to the __init__.py module.

    Returns:
        True when an explicit __all__ assignment is present at module level.
    """
    tree = ast.parse(init_file.read_text(encoding="utf-8"), filename=str(init_file))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "__all__" for target in node.targets
        ):
            return True
        if (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and node.target.id == "__all__"
        ):
            return True
    return False


def _is_excluded_rel(path: Path, repo_root: Path, exclude_dirs: frozenset[str]) -> bool:
    """Return True if any repo-relative path segment belongs to an excluded folder.

    Args:
        path: Candidate path inside repo_root.
        repo_root: Repository root directory.
        exclude_dirs: Directory names to skip.

    Returns:
        True when path should be skipped.
    """
    rel_parts = path.relative_to(repo_root).parts
    return any(part in exclude_dirs or part == "tests" for part in rel_parts)


def _find_python_packages(
    root_dir: Path,
    repo_root: Path,
    exclude_dirs: frozenset[str],
) -> list[Path]:
    """Find all directories under root_dir that contain Python modules.

    Args:
        root_dir: Root directory to inspect.
        repo_root: Repository root directory.
        exclude_dirs: Directory names to skip.

    Returns:
        Sorted list of package directories containing at least one .py file.
    """
    if not root_dir.exists():
        return []
    packages: set[Path] = set()
    for py_file in root_dir.rglob("*.py"):
        if _is_excluded_rel(py_file, repo_root, exclude_dirs):
            continue
        packages.add(py_file.parent)
    return sorted(packages)


def _root_to_package_prefix(rel_root: str) -> str:
    """Convert a configured Python root path into its dotted import prefix.

    Args:
        rel_root: Repo-relative directory path (e.g., 'core/backend/app').

    Returns:
        Dotted Python package prefix (e.g., 'app' or 'scripts.quality').
    """
    parts = Path(rel_root).parts
    if len(parts) >= _MIN_BACKEND_PATH_DEPTH and parts[:2] == _BACKEND_PREFIX_PARTS:
        return ".".join(parts[2:])
    return ".".join(parts)


def _infer_module_package(py_file: Path, repo_root: Path) -> str:
    """Convert a Python source file path into its enclosing dotted package name.

    Args:
        py_file: Source file path inside repo_root.
        repo_root: Repository root directory.

    Returns:
        Dotted package path of the enclosing directory.
    """
    rel_parts = py_file.relative_to(repo_root).with_suffix("").parts
    if len(rel_parts) >= _MIN_BACKEND_PATH_DEPTH and rel_parts[:2] == _BACKEND_PREFIX_PARTS:
        return ".".join(rel_parts[2:-1])
    return ".".join(rel_parts[:-1])


def _in_package_scope(current_pkg: str, target_pkg: str) -> bool:
    """Check whether current_pkg equals or is nested inside target_pkg.

    Args:
        current_pkg: Dotted package name of the importing file.
        target_pkg: Dotted package name of the target boundary.

    Returns:
        True when current_pkg is inside target_pkg.
    """
    return current_pkg == target_pkg or current_pkg.startswith(f"{target_pkg}.")


def _is_barrel_bypass(
    current_pkg: str,
    target_mod: str,
    package_prefixes: tuple[str, ...],
) -> bool:
    """Determine whether an imported module path bypasses a sibling barrel.

    Args:
        current_pkg: Dotted package of the importing module.
        target_mod: Dotted module name being imported.
        package_prefixes: Guarded root package prefixes.

    Returns:
        True when target_mod reaches inside a different subpackage directly.
    """
    for prefix in package_prefixes:
        if not target_mod.startswith(f"{prefix}."):
            continue
        suffix_parts = target_mod.removeprefix(f"{prefix}.").split(".")
        if "." in prefix:
            return not _in_package_scope(current_pkg, prefix) and len(suffix_parts) >= 1
        if len(suffix_parts) >= _MIN_SUBPKG_IMPORT_DEPTH:
            target_subpkg = f"{prefix}.{suffix_parts[0]}"
            return not _in_package_scope(current_pkg, target_subpkg)
    return False


def _iter_imported_modules(tree: ast.AST) -> list[tuple[int, str]]:
    """Extract (line_number, dotted_module) pairs from Import and ImportFrom nodes.

    Args:
        tree: Parsed AST of a Python module.

    Returns:
        List of (lineno, module_name) tuples.
    """
    targets: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            targets.append((node.lineno, node.module))
        elif isinstance(node, ast.Import):
            for alias in node.names:
                targets.append((node.lineno, alias.name))
    return targets


def _check_file_imports(
    py_file: Path,
    repo_root: Path,
    package_prefixes: tuple[str, ...],
) -> list[str]:
    """Flag deep imports crossing sibling package barrels within one file.

    Args:
        py_file: Source file to parse.
        repo_root: Repository root for relative diagnostics.
        package_prefixes: Guarded root package prefixes.

    Returns:
        List of diagnostic error messages for barrel-bypassing imports.
    """
    current_pkg = _infer_module_package(py_file, repo_root)
    tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    violations: list[str] = []

    for lineno, target_mod in _iter_imported_modules(tree):
        if _is_barrel_bypass(current_pkg, target_mod, package_prefixes):
            rel = py_file.relative_to(repo_root).as_posix()
            violations.append(
                f"{rel}:{lineno}: deep import '{target_mod}' bypasses package barrel; "
                "import from the parent package barrel instead.",
            )
    return violations


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
        for pkg_dir in _find_python_packages(
            repo_root / rel_root,
            repo_root,
            config.exclude_dirs,
        ):
            init_file = pkg_dir / "__init__.py"
            rel_pkg = pkg_dir.relative_to(repo_root).as_posix()
            if not init_file.exists():
                errors.append(f"{rel_pkg}: missing barrel file '__init__.py'.")
            elif not _has_dunder_all(init_file):
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
    prefixes = tuple(_root_to_package_prefix(root) for root in config.barrel_python_roots)
    if not prefixes:
        return []

    scan_roots = {
        (repo_root / rel_root).parent
        if len(Path(rel_root).parts) == _MIN_SUBPKG_IMPORT_DEPTH
        else (repo_root / rel_root)
        for rel_root in config.barrel_python_roots
    }

    errors: list[str] = []
    for scan_root in sorted(scan_roots):
        if not scan_root.exists():
            continue
        for py_file in sorted(scan_root.rglob("*.py")):
            if not _is_excluded_rel(py_file, repo_root, config.exclude_dirs):
                errors.extend(_check_file_imports(py_file, repo_root, prefixes))
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
