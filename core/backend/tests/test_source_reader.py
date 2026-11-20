"""Unit tests for source_reader (# @snippet, # @step, diff, zip, path safety)."""

import io
import zipfile
from pathlib import Path

import pytest

from app.core import InvalidLabIdError, LabNotFoundError
from app.services import (
    build_snippet_zip,
    generate_unified_diff,
    parse_snippet_source,
    read_lab_source,
    resolve_lab_dir,
    validate_lab_id,
)


def _create_sample_lab(tmp_path: Path) -> Path:
    """Create a synthetic lab directory with Python and TSX @snippet/@step markers.

    Args:
        tmp_path: Pytest temporary directory.

    Returns:
        Path to the temporary labs root directory.
    """
    lab_dir = tmp_path / "labs" / "01-demo-sqli"
    (lab_dir / "backend").mkdir(parents=True)
    (lab_dir / "frontend").mkdir(parents=True)

    (lab_dir / "README.md").write_text("# Demo SQLi\n", encoding="utf-8")
    (lab_dir / "backend" / "vulnerable.py").write_text(
        '"""Boilerplate header hidden from UI."""\n'
        "# @snippet:start\n"
        "async def login(payload, db):\n"
        "    username = payload.get('username', '')\n"
        "    # @step:build-query\n"
        "    sql = f\"SELECT * FROM users WHERE username = '{username}'\"\n"
        "    # @step:exec-query\n"
        "    return await db.fetch_one(sql)\n"
        "# @snippet:end\n"
        "# trailing footer hidden\n",
        encoding="utf-8",
    )
    (lab_dir / "backend" / "secure.py").write_text(
        "# @snippet:start\n"
        "async def login(payload, db):\n"
        "    username = payload.get('username', '')\n"
        "    # @step:build-query\n"
        '    sql = "SELECT * FROM users WHERE username = $1"\n'
        "    # @step:exec-query\n"
        "    return await db.fetch_one(sql, username)\n"
        "# @snippet:end\n",
        encoding="utf-8",
    )
    (lab_dir / "frontend" / "LabView.tsx").write_text(
        "// @snippet:start\n"
        "export function LabView() {\n"
        "  // @step:fe-submit\n"
        "  return fetch('/api/labs/01-demo-sqli/vulnerable/login');\n"
        "}\n"
        "// @snippet:end\n",
        encoding="utf-8",
    )
    return tmp_path / "labs"


def test_parse_snippet_supports_multiple_blocks_and_orphan_start_fallback() -> None:
    """Verify multi-block @snippet extraction and clean orphan @snippet:start stripping."""
    multi_raw = (
        "# header\n"
        "# @snippet:start\n"
        "# @step:login-step\n"
        "x = 1\n"
        "# @snippet:end\n"
        "# middle hidden\n"
        "# @snippet:start\n"
        "# @step:search-step\n"
        "y = 2\n"
        "# @snippet:end\n"
    )
    parsed = parse_snippet_source(multi_raw)
    assert "middle hidden" not in parsed.code
    assert parsed.steps == {"login-step": 1, "search-step": 3}
    assert parsed.code == "x = 1\n\ny = 2"

    orphan_raw = "# @snippet:start\na = 1\n# @step:calc\nb = a + 2\n"
    orphan_parsed = parse_snippet_source(orphan_raw)
    assert "@snippet:" not in orphan_parsed.code
    assert orphan_parsed.steps == {"calc": 2}


def test_generate_unified_diff_never_glues_last_line_and_normalizes_crlf() -> None:
    """Ensure trailing-line differences stay on separate lines with clean LF output."""
    diff = generate_unified_diff("a = 1\r\nb = 2", "a = 1\nb = 3")

    assert "-b = 2\n+b = 3\n" in diff
    assert "-b = 2+b = 3" not in diff
    assert "\r" not in diff
    assert generate_unified_diff("same\nline", "same\nline") == ""


def test_read_lab_source_and_zip_bundle_diff_matches_raw_files(tmp_path: Path) -> None:
    """Verify read_lab_source, frontend parse, and zip diff.patch matching raw files."""
    labs_dir = _create_sample_lab(tmp_path)

    source = read_lab_source(labs_dir, "01-demo-sqli")
    assert source.vulnerable.steps == {"build-query": 3, "exec-query": 4}
    assert source.secure.steps == {"build-query": 3, "exec-query": 4}
    assert source.frontend is not None
    assert source.frontend.steps == {"fe-submit": 2}
    assert "-    return await db.fetch_one(sql)\n" in source.diff
    assert "+    return await db.fetch_one(sql, username)\n" in source.diff
    assert "-    return await db.fetch_one(sql)+    " not in source.diff

    archive_bytes = build_snippet_zip(labs_dir, "01-demo-sqli")
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
        assert set(zf.namelist()) == {"vulnerable.py", "secure.py", "diff.patch", "README.md"}
        diff_patch = zf.read("diff.patch").decode("utf-8")
        assert '"""Boilerplate header hidden from UI."""' in diff_patch


def test_resolve_lab_dir_blocks_traversal_newlines_and_missing_labs(tmp_path: Path) -> None:
    """Ensure invalid lab IDs (including trailing newline) raise InvalidLabIdError."""
    labs_dir = _create_sample_lab(tmp_path)

    for bad_id in ("../core", "01_UPPER", "01-demo-sqli\n", ""):
        with pytest.raises(InvalidLabIdError):
            validate_lab_id(bad_id)
    with pytest.raises(LabNotFoundError):
        resolve_lab_dir(labs_dir, "99-does-not-exist")
