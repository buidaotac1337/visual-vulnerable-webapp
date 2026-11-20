"""Validate Conventional Commit messages and Git branch naming conventions."""

import re

from scripts.quality.config import CheckResult

_CONVENTIONAL_COMMIT_RE = re.compile(
    r"^(feat|fix|lab|docs|refactor|test|chore|ci|adr|style|perf|build)"
    r"(\([a-z0-9][a-z0-9-]*\))?!?: .+$",
)
_BRANCH_NAME_RE = re.compile(
    r"^(feat|fix|lab|docs|refactor|chore|ci|adr)/[a-z0-9][a-z0-9.-]*$",
)
_MAX_SUBJECT_LENGTH = 72


def validate_commit_message(message: str) -> CheckResult:
    """Check whether a commit message adheres to Conventional Commits.

    Args:
        message: Full raw commit message string.

    Returns:
        CheckResult reporting any commit message format violations.
    """
    first_line = message.strip().splitlines()[0] if message.strip() else ""
    if first_line.startswith(("Merge ", "Revert ")):
        return CheckResult(name="commit-message")

    errors: list[str] = []
    if not _CONVENTIONAL_COMMIT_RE.match(first_line):
        errors.append(
            f"Commit subject '{first_line}' does not match Conventional Commits "
            "(expected '<type>(<scope>): <summary>').",
        )
    if len(first_line) > _MAX_SUBJECT_LENGTH:
        errors.append(
            f"Commit subject length ({len(first_line)}) exceeds {_MAX_SUBJECT_LENGTH} characters.",
        )
    return CheckResult(name="commit-message", errors=tuple(errors))


def validate_branch_name(branch: str, *, allow_main: bool = False) -> CheckResult:
    """Check whether a Git branch name follows the task-prefix convention.

    Args:
        branch: Current Git branch name.
        allow_main: Permit 'main' when running inside CI on default branch pushes.

    Returns:
        CheckResult reporting branch naming violations.
    """
    clean_branch = branch.strip()
    if not clean_branch or clean_branch == "HEAD":
        return CheckResult(name="branch-name")
    if allow_main and clean_branch == "main":
        return CheckResult(name="branch-name")
    if _BRANCH_NAME_RE.match(clean_branch):
        return CheckResult(name="branch-name")
    return CheckResult(
        name="branch-name",
        errors=(
            f"Branch '{clean_branch}' must follow '<type>/<kebab-slug>' "
            "(allowed types: feat, fix, lab, docs, refactor, chore, ci, adr).",
        ),
    )
