"""Validate Markdown documentation links and ADR governance consistency."""

import re
from pathlib import Path

from scripts.quality.config import CheckResult

_INLINE_CODE_PATTERN = re.compile(r"`[^`]*`")
_MD_LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
_ADR_FILE_PATTERN = re.compile(r"^(\d{4})-[a-z0-9-]+\.md$")
_REQUIRED_ADR_HEADINGS = ("## Status", "## Context", "## Decision", "## Consequences")


def _iter_markdown_files(repo_root: Path) -> list[Path]:
    """Collect repository Markdown documentation files.

    Args:
        repo_root: Repository root directory.

    Returns:
        Sorted list of Markdown file paths across root, docs/, and labs/.
    """
    files: list[Path] = []
    for root_file in ("README.md", "AGENTS.md"):
        candidate = repo_root / root_file
        if candidate.exists():
            files.append(candidate)
    for folder in ("docs", "labs"):
        folder_path = repo_root / folder
        if folder_path.exists():
            files.extend(folder_path.rglob("*.md"))
    return sorted(set(files))


def _validate_link_target(
    target: str,
    md_file: Path,
    repo_root: Path,
    line_no: int,
) -> str | None:
    """Validate one Markdown link target against repository boundaries and disk.

    Args:
        target: Extracted raw link target.
        md_file: Source Markdown file path.
        repo_root: Repository root directory.
        line_no: 1-based line number of the link.

    Returns:
        Error message string if invalid, otherwise None.
    """
    if target.startswith(("http://", "https://", "mailto:", "#", "file://")):
        return None
    path_only = target.split("#", maxsplit=1)[0]
    if not path_only:
        return None
    resolved = (md_file.parent / path_only).resolve()
    rel_md = md_file.relative_to(repo_root).as_posix()
    if not resolved.is_relative_to(repo_root.resolve()):
        return f"{rel_md}:{line_no}: relative link '{target}' escapes repository root."
    if not resolved.exists():
        return f"{rel_md}:{line_no}: broken relative link '{target}'."
    return None


def _check_relative_links(md_file: Path, repo_root: Path) -> list[str]:
    """Check that all relative Markdown links inside a file resolve inside repo_root.

    Args:
        md_file: Markdown file to scan.
        repo_root: Repository root for diagnostic formatting.

    Returns:
        List of broken-link error messages.
    """
    errors: list[str] = []
    content = md_file.read_text(encoding="utf-8")
    in_code_block = False

    for line_no, line in enumerate(content.splitlines(), start=1):
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        sanitized = _INLINE_CODE_PATTERN.sub("", line)
        for raw_target in _MD_LINK_PATTERN.findall(sanitized):
            target = raw_target.strip().split(" ", maxsplit=1)[0]
            error = _validate_link_target(target, md_file, repo_root, line_no)
            if error is not None:
                errors.append(error)
    return errors


def _has_exact_heading(text: str, heading: str) -> bool:
    """Return True if a Markdown file contains the exact heading on its own line.

    Args:
        text: Full Markdown document text.
        heading: Heading string (e.g., '## Status').

    Returns:
        True when an exact line-anchored heading is present.
    """
    return re.search(rf"^{re.escape(heading)}\s*$", text, re.MULTILINE) is not None


def _check_adr_governance(repo_root: Path) -> list[str]:
    """Ensure ADR files follow naming, uniqueness, required sections, and index registration.

    Args:
        repo_root: Repository root directory.

    Returns:
        List of ADR compliance violations.
    """
    adr_dir = repo_root / "docs" / "adr"
    if not adr_dir.exists():
        return ["docs/adr: missing Architecture Decision Records directory."]

    index_file = adr_dir / "README.md"
    if not index_file.exists():
        return ["docs/adr/README.md: missing ADR index file."]

    index_content = index_file.read_text(encoding="utf-8")
    seen_ids: dict[str, str] = {}
    errors: list[str] = []

    for adr_file in sorted(adr_dir.glob("*.md")):
        if adr_file.name in {"README.md", "0000-template.md"}:
            continue
        match = _ADR_FILE_PATTERN.match(adr_file.name)
        if not match:
            errors.append(f"docs/adr/{adr_file.name}: filename must match NNNN-kebab-title.md.")
            continue
        adr_id = match.group(1)
        if adr_id in seen_ids:
            errors.append(
                f"docs/adr/{adr_file.name}: duplicate ADR ID '{adr_id}' "
                f"(already used by {seen_ids[adr_id]}).",
            )
        seen_ids[adr_id] = adr_file.name
        if adr_file.name not in index_content:
            errors.append(f"docs/adr/{adr_file.name}: not listed in docs/adr/README.md.")
        text = adr_file.read_text(encoding="utf-8")
        for heading in _REQUIRED_ADR_HEADINGS:
            if not _has_exact_heading(text, heading):
                errors.append(f"docs/adr/{adr_file.name}: missing required section '{heading}'.")
    return errors


def check_docs(repo_root: Path) -> CheckResult:
    """Run all documentation quality and ADR governance checks.

    Args:
        repo_root: Repository root directory.

    Returns:
        CheckResult summarizing broken links and ADR governance issues.
    """
    errors: list[str] = []
    for md_file in _iter_markdown_files(repo_root):
        errors.extend(_check_relative_links(md_file, repo_root))
    errors.extend(_check_adr_governance(repo_root))
    return CheckResult(name="docs-governance", errors=tuple(errors))
