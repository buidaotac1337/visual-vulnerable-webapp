"""Unit tests for the design-token SSOT checker (ADR-0012)."""

from pathlib import Path

from scripts.quality import check_design_tokens

TOKENS = Path("core/frontend/src/styles/tokens")


def _write(root: Path, rel: str, text: str) -> None:
    """Write a fixture file, creating parent directories."""
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _valid_tree(root: Path) -> None:
    """Create a minimal token tree that satisfies every rule."""
    _write(root, f"{TOKENS}/palette.css", ":root {\n  --vv-palette-red-700: #C9372C;\n}\n")
    _write(
        root,
        f"{TOKENS}/theme-light.css",
        ":root {\n  --vv-text-danger: var(--vv-palette-red-700);\n}\n",
    )
    _write(
        root,
        f"{TOKENS}/theme-dark.css",
        '[data-color-mode="dark"] {\n  --vv-text-danger: var(--vv-palette-red-700);\n}\n',
    )
    _write(root, f"{TOKENS}/foundations.css", "/* https://example.com in a comment is fine */\n")
    _write(
        root,
        f"{TOKENS}/tailwind-theme.css",
        "@theme inline {\n  --text-color-danger: var(--vv-text-danger);\n}\n",
    )
    _write(
        root,
        "core/frontend/index.html",
        '<html data-color-mode="light"><!-- https://x.io --></html>\n',
    )


def test_design_tokens_gate_accepts_a_valid_tree(tmp_path: Path) -> None:
    """A palette-only colour source with matching themes passes."""
    _valid_tree(tmp_path)
    result = check_design_tokens(tmp_path)
    assert result.passed, result.errors


def test_design_tokens_gate_flags_literals_parity_references_and_urls(tmp_path: Path) -> None:
    """Each kind of SSOT violation produces its own blocking error."""
    _valid_tree(tmp_path)
    _write(tmp_path, "core/frontend/src/styles/pipeline.css", ".x { color: rgba(0, 0, 0, 0.5); }\n")
    _write(
        tmp_path,
        f"{TOKENS}/theme-light.css",
        ":root {\n  --vv-text-danger: var(--vv-palette-red-700);\n  --vv-text-extra: #fff;\n}\n",
    )
    _write(
        tmp_path,
        f"{TOKENS}/tailwind-theme.css",
        "@theme inline {\n  --text-color-x: var(--vv-missing);\n}\n",
    )
    _write(tmp_path, f"{TOKENS}/fonts.css", "@import url('https://fonts.googleapis.com/css2');\n")

    errors = "\n".join(check_design_tokens(tmp_path).errors)

    assert "pipeline.css:1: colour literal" in errors
    assert "theme-light.css:3: colour literal" in errors
    assert "--vv-text-extra is declared in light but not dark" in errors
    assert "--vv-missing is not declared" in errors
    assert "external URL" in errors and "fonts.googleapis.com" in errors


def test_design_tokens_gate_requires_the_tokens_directory(tmp_path: Path) -> None:
    """A repository without the token tree fails loudly instead of passing vacuously."""
    result = check_design_tokens(tmp_path)
    assert not result.passed
    assert "missing core/frontend/src/styles/tokens/" in result.errors[0]
