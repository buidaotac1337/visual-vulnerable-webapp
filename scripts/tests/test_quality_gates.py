"""Unit tests for VVWA quality checkers, runners, and gate classification."""

import subprocess
from pathlib import Path
from unittest.mock import patch

from scripts.quality import (
    QualityConfig,
    check_barrels,
    check_docs,
    check_file_limits,
    classify_changed_files,
    execute_gate,
    git_changed_files,
    validate_branch_name,
    validate_commit_message,
)


def _sample_config() -> QualityConfig:
    """Construct a minimal QualityConfig tailored for isolated temp-dir tests.

    Returns:
        QualityConfig with standard 350/280 line thresholds.
    """
    return QualityConfig(
        max_lines_per_file=350,
        warn_lines_per_file=280,
        source_roots=("core", "labs", "scripts"),
        source_extensions=(".py", ".ts", ".tsx"),
        exclude_dirs=frozenset({"node_modules", ".venv", "__pycache__", "dist"}),
        barrel_python_roots=("core/backend/app",),
        barrel_frontend_dirs=("core/frontend/src/components",),
    )


def test_file_limits_enforces_350_line_ceiling_even_under_dist_parent(tmp_path: Path) -> None:
    """Ensure 350 LOC passes, 351 LOC fails, and parent dir names do not cause skips."""
    repo_root = tmp_path / "dist" / "vvwa"
    ok_file = repo_root / "core" / "ok.py"
    ok_file.parent.mkdir(parents=True)
    ok_file.write_text("\n".join(["x = 1"] * 350) + "\n", encoding="utf-8")

    result_ok = check_file_limits(repo_root, _sample_config())
    assert result_ok.passed
    assert len(result_ok.warnings) == 1

    bad_file = repo_root / "core" / "too_long.py"
    bad_file.write_text("\n".join(["x = 1"] * 351) + "\n", encoding="utf-8")

    result_bad = check_file_limits(repo_root, _sample_config())
    assert not result_bad.passed
    assert any("too_long.py" in err for err in result_bad.errors)


def test_barrels_detects_deep_imports_and_nested_frontend_barrels(tmp_path: Path) -> None:
    """Verify barrel checker catches Import, prefix collisions, __init__ bypass, & nested TS."""
    repo_root = tmp_path / "tests" / "vvwa"
    api_dir = repo_root / "core" / "backend" / "app" / "api"
    api_v2_dir = repo_root / "core" / "backend" / "app" / "api_v2"
    schemas_dir = repo_root / "core" / "backend" / "app" / "schemas"
    nested_fe = repo_root / "core" / "frontend" / "src" / "components" / "workspace"
    for folder in (api_dir, api_v2_dir, schemas_dir, nested_fe):
        folder.mkdir(parents=True)

    (repo_root / "core" / "backend" / "app" / "__init__.py").write_text(
        "__all__ = []\n",
        encoding="utf-8",
    )
    (api_dir / "__init__.py").write_text(
        'from app.schemas.item import Item\n__all__ = ["Item"]\n',
        encoding="utf-8",
    )
    (api_v2_dir / "__init__.py").write_text("__all__ = []\n", encoding="utf-8")
    (api_v2_dir / "routes.py").write_text(
        "import app.api.health\n",
        encoding="utf-8",
    )
    (schemas_dir / "__init__.py").write_text('__all__ = ["Item"]\n', encoding="utf-8")
    (repo_root / "core" / "frontend" / "src" / "components" / "index.ts").write_text(
        "export {};\n",
        encoding="utf-8",
    )
    (nested_fe / "Pane.tsx").write_text("export const x = 1;\n", encoding="utf-8")

    result = check_barrels(repo_root, _sample_config())
    assert not result.passed
    assert any("app/api/__init__.py" in err for err in result.errors)
    assert any("app/api_v2/routes.py" in err for err in result.errors)
    assert any("components/workspace" in err for err in result.errors)


def test_classifier_runs_docs_only_gate_for_markdown_changes() -> None:
    """Confirm doc-only edits skip backend, frontend, and infra gates."""
    gates = classify_changed_files(["docs/01-architecture.md", "README.md", "AGENTS.md"])
    assert gates == {"hygiene", "docs"}


def test_classifier_routes_logic_and_infra_changes_precisely() -> None:
    """Confirm code, scripts, and infra edits trigger their matching gates."""
    assert classify_changed_files(["core/backend/app/main.py"]) == {"hygiene", "backend"}
    assert classify_changed_files(["core/frontend/src/App.tsx"]) == {"hygiene", "frontend"}
    assert classify_changed_files(["docker-compose.yml", ".dockerignore"]) == {"hygiene", "infra"}
    assert classify_changed_files(["labs/01-sql-injection/meta.json"]) == {"hygiene", "backend"}
    assert classify_changed_files(["scripts/gates.py"]) == {"hygiene", "docs", "backend", "infra"}


def test_commit_and_branch_validators() -> None:
    """Verify Conventional Commits and task branch naming validation."""
    assert validate_commit_message("feat(lab-01): add sql injection trace").passed
    assert validate_commit_message("docs(adr): record uv workspace decision").passed
    assert not validate_commit_message("updated stuff").passed

    assert validate_branch_name("feat/init-boilerplate").passed
    assert validate_branch_name("lab/01-sql-injection").passed
    assert not validate_branch_name("random-branch").passed
    assert not validate_branch_name("main").passed
    assert validate_branch_name("main", allow_main=True).passed


def test_docs_checker_catches_escape_links_fake_headings_and_duplicate_ids(tmp_path: Path) -> None:
    """Verify docs checker ignores inline code, catches escapes, bad headings, and dupe IDs."""
    adr_dir = tmp_path / "docs" / "adr"
    adr_dir.mkdir(parents=True)
    (tmp_path / "README.md").write_text(
        "Inline `[ignore](missing.md)` ok.\n[Escape](../outside.md)\n[Broken](docs/missing.md)\n",
        encoding="utf-8",
    )
    (adr_dir / "README.md").write_text(
        "# ADR Index\n- 0001-first.md\n- 0001-second.md\n",
        encoding="utf-8",
    )
    (adr_dir / "0001-first.md").write_text(
        "# 0001\n### Status\nAccepted\n## Context\nC\n## Decision\nD\n## Consequences\nE\n",
        encoding="utf-8",
    )
    (adr_dir / "0001-second.md").write_text(
        "# 0001\n## Status\nAccepted\n## Context\nC\n## Decision\nD\n## Consequences\nE\n",
        encoding="utf-8",
    )

    result = check_docs(tmp_path)
    assert not result.passed
    assert not any("missing.md" in err and "Inline" in err for err in result.errors)
    assert any("escapes repository root" in err for err in result.errors)
    assert any("broken relative link 'docs/missing.md'" in err for err in result.errors)
    assert any("missing required section '## Status'" in err for err in result.errors)
    assert any("duplicate ADR ID '0001'" in err for err in result.errors)


def test_git_changed_files_expands_untracked_dirs_and_committed_branch_diff(
    tmp_path: Path,
) -> None:
    """Ensure --auto file detection captures both nested untracked files and branch commits."""
    subprocess.run(["git", "init", "-b", "main"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@vvwa.local"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "VVWA Test"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    (tmp_path / "README.md").write_text("# init\n", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "chore: init"], cwd=tmp_path, check=True)

    subprocess.run(["git", "checkout", "-b", "feat/demo"], cwd=tmp_path, check=True)
    committed = tmp_path / "core" / "backend" / "app" / "x.py"
    committed.parent.mkdir(parents=True)
    committed.write_text("x = 1\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-m", "feat: add backend file"], cwd=tmp_path, check=True)

    untracked = tmp_path / "core" / "frontend" / "src" / "New.tsx"
    untracked.parent.mkdir(parents=True)
    untracked.write_text("export const n = 1;\n", encoding="utf-8")

    changed = git_changed_files(tmp_path)
    assert "core/backend/app/x.py" in changed
    assert "core/frontend/src/New.tsx" in changed


def test_frontend_gate_passes_resolved_pnpm_binary_path(tmp_path: Path) -> None:
    """Ensure Windows pnpm.CMD resolution passes the resolved path into subprocess calls."""
    (tmp_path / "pyproject.toml").write_text("[tool.vvwa.quality]\n", encoding="utf-8")
    (tmp_path / "core" / "frontend").mkdir(parents=True)
    seen_commands: list[list[str]] = []

    def _fake_run(cmd: list[str], cwd: Path) -> bool:
        seen_commands.append(cmd)
        return True

    with (
        patch("scripts.quality.runners.shutil.which", return_value=r"C:\tools\pnpm.CMD"),
        patch("scripts.quality.runners.run_command", side_effect=_fake_run),
    ):
        assert execute_gate("frontend", tmp_path, allow_main=False)

    assert len(seen_commands) == 5
    assert all(cmd[0] == r"C:\tools\pnpm.CMD" for cmd in seen_commands)
