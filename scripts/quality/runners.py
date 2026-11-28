"""Subprocess execution helpers for running individual quality gates."""

import shutil
import subprocess
from pathlib import Path

from scripts.quality.check_barrels import check_barrels
from scripts.quality.check_docs import check_docs
from scripts.quality.check_file_limits import check_file_limits
from scripts.quality.check_git_rules import validate_branch_name
from scripts.quality.classifier import GateName
from scripts.quality.config import CheckResult, load_quality_config
from scripts.quality.git_helpers import current_git_branch

PINNED_NODE_IMAGE = "node:26.13.1-alpine"
PINNED_PNPM_VERSION = "10.12.1"


def print_result(result: CheckResult) -> bool:
    """Print formatted check diagnostics and return pass status.

    Args:
        result: CheckResult returned by a Python checker.

    Returns:
        True when result.passed is True.
    """
    status = "PASS" if result.passed else "FAIL"
    print(f"[{status}] {result.name}")
    for warning in result.warnings:
        print(f"  WARN: {warning}")
    for error in result.errors:
        print(f"  ERROR: {error}")
    return result.passed


def run_command(command: list[str], cwd: Path) -> bool:
    """Execute a subprocess command streaming output to stdout/stderr.

    Args:
        command: Command token list to execute.
        cwd: Working directory for the process.

    Returns:
        True if the command exited with code 0.
    """
    print(f"$ {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    return completed.returncode == 0


def _collect_mypy_runs(repo_root: Path) -> list[list[str]]:
    """Build the mypy --strict invocations: one for core code, then one per lab backend.

    Every lab ships modules named vulnerable.py and secure.py without a package, so
    checking two labs in one invocation fails with "Duplicate module named 'secure'".

    Args:
        repo_root: Repository root directory.

    Returns:
        List of target lists, each passed to its own mypy run.
    """
    runs = [["core/backend/app", "core/backend/tests", "scripts"]]
    labs_dir = repo_root / "labs"
    if labs_dir.exists():
        for lab_backend in sorted(labs_dir.glob("*/backend")):
            if any(lab_backend.rglob("*.py")):
                runs.append([lab_backend.relative_to(repo_root).as_posix()])
    return runs


def _run_backend_gate(repo_root: Path) -> bool:
    """Execute all Gate 2 backend code quality, typing, and test checks.

    Args:
        repo_root: Repository root directory.

    Returns:
        True when every backend check passes.
    """
    config = load_quality_config(repo_root)
    mypy_runs = [
        run_command(["uv", "run", "mypy", *targets], cwd=repo_root)
        for targets in _collect_mypy_runs(repo_root)
    ]
    checks = [
        print_result(check_file_limits(repo_root, config)),
        print_result(check_barrels(repo_root, config)),
        run_command(["uv", "run", "ruff", "check", "."], cwd=repo_root),
        run_command(["uv", "run", "ruff", "format", "--check", "."], cwd=repo_root),
        all(mypy_runs),
        run_command(["uv", "run", "pytest", "-v"], cwd=repo_root),
    ]
    return all(checks)


def _run_frontend_gate(repo_root: Path) -> bool:
    """Execute all Gate 3 frontend lint, format, typecheck, test, and build checks.

    Uses local pnpm when available (resolving exact binary path for Windows),
    automatically falling back to the pinned Docker Node image otherwise.

    Args:
        repo_root: Repository root directory.

    Returns:
        True when every frontend check passes.
    """
    config = load_quality_config(repo_root)
    if not print_result(check_file_limits(repo_root, config)):
        return False
    if not print_result(check_barrels(repo_root, config)):
        return False

    frontend_dir = repo_root / "core" / "frontend"
    pnpm_bin = shutil.which("pnpm")
    if pnpm_bin is not None:
        commands = [
            [pnpm_bin, "lint"],
            [pnpm_bin, "format:check"],
            [pnpm_bin, "typecheck"],
            [pnpm_bin, "test"],
            [pnpm_bin, "build"],
        ]
        return all(run_command(cmd, cwd=frontend_dir) for cmd in commands)

    labs_dir = repo_root / "labs"
    script = (
        f"npm install -g pnpm@{PINNED_PNPM_VERSION} && "
        "pnpm install --frozen-lockfile --store-dir /pnpm/store && pnpm lint && "
        "pnpm format:check && pnpm typecheck && pnpm test && "
        "pnpm exec vite build --outDir /tmp/vvwa-dist"
    )
    docker_cmd = [
        "docker",
        "run",
        "--rm",
        "-e",
        "CI=true",
        "-e",
        "npm_config_store_dir=/pnpm/store",
        "-v",
        f"{frontend_dir.as_posix()}:/app/core/frontend",
        "-v",
        f"{labs_dir.as_posix()}:/app/labs",
        "-v",
        "vvwa_frontend_node_modules:/app/core/frontend/node_modules",
        "-v",
        "vvwa_pnpm_store:/pnpm/store",
        "-w",
        "/app/core/frontend",
        PINNED_NODE_IMAGE,
        "sh",
        "-c",
        script,
    ]
    return run_command(docker_cmd, cwd=repo_root)


def _run_infra_gate(repo_root: Path) -> bool:
    """Execute Gate 4 Docker Compose and PostgreSQL SQL sanity checks.

    Args:
        repo_root: Repository root directory.

    Returns:
        True when infrastructure validation succeeds.
    """
    for rel_sql in ("core/postgres/init.sql", "core/postgres/seed.sql"):
        sql_file = repo_root / rel_sql
        if not sql_file.exists() or not sql_file.read_text(encoding="utf-8").strip():
            print(f"[FAIL] infra: missing or empty {rel_sql}")
            return False
    return run_command(["docker", "compose", "config", "-q"], cwd=repo_root)


def execute_gate(gate: GateName, repo_root: Path, *, allow_main: bool) -> bool:
    """Dispatch execution to the requested quality gate handler.

    Args:
        gate: Gate name to run.
        repo_root: Repository root directory.
        allow_main: Whether 'main' branch is permitted in hygiene checks.

    Returns:
        True when the gate passes.
    """
    print(f"\n=== Running Gate: {gate.upper()} ===")
    if gate == "hygiene":
        branch = current_git_branch(repo_root)
        return print_result(validate_branch_name(branch, allow_main=allow_main))
    if gate == "docs":
        return print_result(check_docs(repo_root))
    if gate == "backend":
        return _run_backend_gate(repo_root)
    if gate == "frontend":
        return _run_frontend_gate(repo_root)
    return _run_infra_gate(repo_root)
