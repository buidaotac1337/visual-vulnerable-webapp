"""Source code reader, # @snippet/@step parser, diff generator, and zip bundler."""

import difflib
import io
import re
import zipfile
from pathlib import Path

from app.core import InvalidLabIdError, LabNotFoundError
from app.schemas import LabSourceResponse, ParsedSourceFile

_LAB_ID_PATTERN = re.compile(r"\A[a-z0-9][a-z0-9-]*\Z")
_SNIPPET_START_RE = re.compile(r"\A\s*(?:#|//)\s*@snippet:start\s*\Z")
_SNIPPET_END_RE = re.compile(r"\A\s*(?:#|//)\s*@snippet:end\s*\Z")
_STEP_TAG_RE = re.compile(r"\A\s*(?:#|//)\s*@step:([a-zA-Z0-9_-]+)\s*\Z")


def validate_lab_id(lab_id: str) -> str:
    """Validate that a lab identifier uses safe kebab-case characters only.

    Args:
        lab_id: Candidate lab identifier from URL path or configuration.

    Returns:
        Validated lab identifier string.

    Raises:
        InvalidLabIdError: If lab_id contains path separators, newlines, or invalid chars.
    """
    if not _LAB_ID_PATTERN.match(lab_id):
        msg = f"Invalid lab_id '{lab_id}'; expected lowercase kebab-case."
        raise InvalidLabIdError(msg)
    return lab_id


def resolve_lab_dir(labs_dir: Path, lab_id: str) -> Path:
    """Resolve and verify a lab directory strictly inside labs_dir.

    Args:
        labs_dir: Root directory containing all educational labs.
        lab_id: Lab identifier to resolve.

    Returns:
        Resolved absolute Path to the lab folder.

    Raises:
        InvalidLabIdError: If lab_id is malformed, escapes labs_dir, or points to labs_dir.
        LabNotFoundError: If the lab folder does not exist.
    """
    safe_id = validate_lab_id(lab_id)
    base_dir = labs_dir.resolve()
    candidate = (base_dir / safe_id).resolve()
    if candidate == base_dir or not candidate.is_relative_to(base_dir):
        msg = f"Lab path for '{lab_id}' escapes labs root directory."
        raise InvalidLabIdError(msg)
    if not candidate.is_dir():
        msg = f"Lab '{safe_id}' was not found."
        raise LabNotFoundError(msg)
    return candidate


def _extract_snippet_lines(lines: list[str]) -> list[str]:
    """Extract all complete @snippet:start..end blocks, or fall back cleanly.

    Supports multiple snippet blocks in one file (separated by a blank line).
    If no complete start..end pair exists, returns all non-marker lines so
    orphan @snippet comments never leak to the UI.

    Args:
        lines: Raw file lines without trailing newline characters.

    Returns:
        Selected list of lines to parse for @step annotations.
    """
    blocks: list[list[str]] = []
    current_block: list[str] | None = None

    for line in lines:
        if _SNIPPET_START_RE.match(line) and current_block is None:
            current_block = []
        elif _SNIPPET_END_RE.match(line) and current_block is not None:
            blocks.append(current_block)
            current_block = None
        elif current_block is not None:
            current_block.append(line)

    if blocks:
        combined: list[str] = []
        for idx, block in enumerate(blocks):
            if idx > 0:
                combined.append("")
            combined.extend(block)
        return combined

    return [
        line for line in lines if not (_SNIPPET_START_RE.match(line) or _SNIPPET_END_RE.match(line))
    ]


def parse_snippet_source(raw_text: str) -> ParsedSourceFile:
    """Parse @snippet boundaries and resolve @step tags to 1-based line numbers.

    Args:
        raw_text: Complete source text read from disk.

    Returns:
        ParsedSourceFile containing cleaned code, step-to-line map, and line count.
    """
    selected = _extract_snippet_lines(raw_text.splitlines())
    cleaned_lines: list[str] = []
    steps: dict[str, int] = {}
    pending_tags: list[str] = []

    for line in selected:
        step_match = _STEP_TAG_RE.match(line)
        if step_match is not None:
            pending_tags.append(step_match.group(1))
            continue
        cleaned_lines.append(line)
        if pending_tags and line.strip():
            line_number = len(cleaned_lines)
            for tag in pending_tags:
                steps[tag] = line_number
            pending_tags.clear()

    code = "\n".join(cleaned_lines)
    return ParsedSourceFile(code=code, steps=steps, line_count=len(cleaned_lines))


def generate_unified_diff(vulnerable_code: str, secure_code: str) -> str:
    """Produce a normalized LF unified diff comparing vulnerable vs secure code.

    Args:
        vulnerable_code: Vulnerable source text.
        secure_code: Secure source text.

    Returns:
        Unified diff string ending with LF when non-empty, or empty string if identical.
    """
    diff_lines = list(
        difflib.unified_diff(
            vulnerable_code.splitlines(),
            secure_code.splitlines(),
            fromfile="vulnerable.py",
            tofile="secure.py",
            lineterm="",
        ),
    )
    if not diff_lines:
        return ""
    return "\n".join(diff_lines) + "\n"


def _read_required_file(file_path: Path, lab_id: str) -> str:
    """Read a mandatory lab file or raise LabNotFoundError.

    Args:
        file_path: Path to read.
        lab_id: Owning lab identifier for diagnostic messages.

    Returns:
        UTF-8 decoded file content.

    Raises:
        LabNotFoundError: If file_path does not exist.
    """
    if not file_path.is_file():
        msg = f"Required file '{file_path.name}' not found in lab '{lab_id}'."
        raise LabNotFoundError(msg)
    return file_path.read_text(encoding="utf-8")


def read_lab_source(labs_dir: Path, lab_id: str) -> LabSourceResponse:
    """Read live lab source files from disk, parse @step maps, and compute diff.

    Args:
        labs_dir: Root labs directory.
        lab_id: Lab identifier to inspect.

    Returns:
        LabSourceResponse with parsed vulnerable, secure, optional frontend, and diff.
    """
    lab_dir = resolve_lab_dir(labs_dir, lab_id)
    vuln_raw = _read_required_file(lab_dir / "backend" / "vulnerable.py", lab_id)
    sec_raw = _read_required_file(lab_dir / "backend" / "secure.py", lab_id)

    vulnerable = parse_snippet_source(vuln_raw)
    secure = parse_snippet_source(sec_raw)

    frontend_path = lab_dir / "frontend" / "LabView.tsx"
    frontend = (
        parse_snippet_source(frontend_path.read_text(encoding="utf-8"))
        if frontend_path.is_file()
        else None
    )

    return LabSourceResponse(
        lab_id=lab_id,
        vulnerable=vulnerable,
        secure=secure,
        frontend=frontend,
        diff=generate_unified_diff(vulnerable.code, secure.code),
    )


def build_snippet_zip(labs_dir: Path, lab_id: str) -> bytes:
    """Bundle vulnerable.py, secure.py, matching diff.patch, and README.md as ZIP.

    Args:
        labs_dir: Root labs directory.
        lab_id: Lab identifier to package.

    Returns:
        Raw bytes of the in-memory ZIP archive.
    """
    lab_dir = resolve_lab_dir(labs_dir, lab_id)
    vuln_raw = _read_required_file(lab_dir / "backend" / "vulnerable.py", lab_id)
    sec_raw = _read_required_file(lab_dir / "backend" / "secure.py", lab_id)
    diff_text = generate_unified_diff(vuln_raw, sec_raw)
    readme_path = lab_dir / "README.md"
    readme_text = (
        readme_path.read_text(encoding="utf-8")
        if readme_path.is_file()
        else f"# {lab_id}\n\nEducational security snippet exported from VVWA.\n"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("vulnerable.py", vuln_raw)
        archive.writestr("secure.py", sec_raw)
        archive.writestr("diff.patch", diff_text)
        archive.writestr("README.md", readme_text)
    return buffer.getvalue()
