"""Git inspection helpers for branch hygiene and --auto gate selection."""

import subprocess
from pathlib import Path

_MIN_PORCELAIN_LINE_LEN = 4


def _git_status_files(repo_root: Path) -> set[str]:
    """Collect unstaged, staged, and expanded untracked files from git status.

    Args:
        repo_root: Repository root directory.

    Returns:
        Set of repo-relative file paths from the working tree.
    """
    completed = subprocess.run(
        ["git", "status", "--porcelain", "-uall"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return set()
    paths: set[str] = set()
    for line in completed.stdout.splitlines():
        if len(line) < _MIN_PORCELAIN_LINE_LEN:
            continue
        raw_path = line[3:].strip().strip('"')
        if " -> " in raw_path:
            raw_path = raw_path.split(" -> ", maxsplit=1)[1].strip('"')
        paths.add(raw_path)
    return paths


def _git_branch_diff_files(repo_root: Path) -> set[str]:
    """Collect files committed on the current branch relative to main/origin/main.

    Args:
        repo_root: Repository root directory.

    Returns:
        Set of repo-relative file paths committed on the current task branch.
    """
    for base_ref in ("main", "origin/main"):
        verify = subprocess.run(
            ["git", "rev-parse", "--verify", "--quiet", base_ref],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        if verify.returncode != 0:
            continue
        diff = subprocess.run(
            ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        if diff.returncode == 0:
            return {line.strip() for line in diff.stdout.splitlines() if line.strip()}
    return set()


def git_changed_files(repo_root: Path) -> list[str]:
    """Return all repo-relative files modified in working tree or branch commits.

    Args:
        repo_root: Repository root directory.

    Returns:
        Sorted deduplicated list of changed file paths.
    """
    combined = _git_status_files(repo_root) | _git_branch_diff_files(repo_root)
    return sorted(combined)


def current_git_branch(repo_root: Path) -> str:
    """Read the currently checked-out Git branch name.

    Args:
        repo_root: Repository root directory.

    Returns:
        Active branch name or empty string if unavailable.
    """
    completed = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    return completed.stdout.strip() if completed.returncode == 0 else ""
