"""Enforce the design-token SSOT (ADR-0012): colour literals, light/dark parity, offline assets."""

import re
from pathlib import Path

from scripts.quality.config import CheckResult

FRONTEND = Path("core/frontend")
TOKENS_DIR = FRONTEND / "src" / "styles" / "tokens"
PALETTE_FILE = TOKENS_DIR / "palette.css"
LIGHT_FILE = TOKENS_DIR / "theme-light.css"
DARK_FILE = TOKENS_DIR / "theme-dark.css"
FOUNDATIONS_FILE = TOKENS_DIR / "foundations.css"
INDEX_HTML = FRONTEND / "index.html"

COLOUR_LITERAL = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(")
DECLARED = re.compile(r"(--vv-[a-z0-9-]+)\s*:")
REFERENCED = re.compile(r"var\(\s*(--vv-[a-z0-9-]+)")
EXTERNAL_URL = re.compile(r"\b(?:https?:)?//[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


def _read(path: Path, comment: re.Pattern[str] = CSS_COMMENT) -> str:
    """Read a text file without its comments; a missing file reads as empty."""
    return comment.sub("", path.read_text(encoding="utf-8")) if path.is_file() else ""


def _style_sources(repo_root: Path) -> list[Path]:
    """List every stylesheet under the frontend source tree."""
    return sorted((repo_root / FRONTEND / "src").rglob("*.css"))


def _colour_literal_errors(repo_root: Path) -> list[str]:
    """Report colour literals outside palette.css (the only file allowed to hold them)."""
    errors: list[str] = []
    palette = (repo_root / PALETTE_FILE).resolve()
    for path in _style_sources(repo_root):
        if path.resolve() == palette:
            continue
        for lineno, line in enumerate(_read(path).splitlines(), start=1):
            if COLOUR_LITERAL.search(line):
                rel = path.relative_to(repo_root).as_posix()
                errors.append(f"{rel}:{lineno}: colour literal outside {PALETTE_FILE.as_posix()}")
    return errors


def _parity_errors(repo_root: Path) -> list[str]:
    """Report semantic tokens declared in only one of the light and dark themes."""
    light = set(DECLARED.findall(_read(repo_root / LIGHT_FILE)))
    dark = set(DECLARED.findall(_read(repo_root / DARK_FILE)))
    if not light:
        return [f"{LIGHT_FILE.as_posix()}: no --vv-* tokens found"]
    only_light = [f"{name} is declared in light but not dark" for name in sorted(light - dark)]
    only_dark = [f"{name} is declared in dark but not light" for name in sorted(dark - light)]
    return only_light + only_dark


def _undefined_reference_errors(repo_root: Path) -> list[str]:
    """Report var(--vv-*) references that no token file declares."""
    defining = (PALETTE_FILE, LIGHT_FILE, DARK_FILE, FOUNDATIONS_FILE)
    declared: set[str] = set()
    for rel in defining:
        declared.update(DECLARED.findall(_read(repo_root / rel)))
    errors: list[str] = []
    for path in _style_sources(repo_root):
        for name in sorted(set(REFERENCED.findall(_read(path))) - declared):
            errors.append(f"{path.relative_to(repo_root).as_posix()}: {name} is not declared")
    return errors


def _external_url_errors(repo_root: Path) -> list[str]:
    """Report external URLs in index.html and stylesheets (the app must run offline)."""
    sources = [(repo_root / INDEX_HTML, _read(repo_root / INDEX_HTML, HTML_COMMENT))]
    sources += [(path, _read(path)) for path in _style_sources(repo_root)]
    errors: list[str] = []
    for path, text in sources:
        for match in EXTERNAL_URL.finditer(text):
            rel = path.relative_to(repo_root).as_posix()
            errors.append(f"{rel}: external URL '{match.group(0)}' (fonts/assets must be bundled)")
    return errors


def check_design_tokens(repo_root: Path) -> CheckResult:
    """Validate the design-token SSOT described in ADR-0012.

    Checks that colour literals live only in tokens/palette.css, that the light and dark
    themes declare the same --vv-* tokens, that every var(--vv-*) used in a stylesheet is
    declared, and that index.html and stylesheets reference no external URL.

    Args:
        repo_root: Repository root directory.

    Returns:
        CheckResult listing every violation as a blocking error.
    """
    if not (repo_root / TOKENS_DIR).is_dir():
        return CheckResult(name="design-tokens", errors=(f"missing {TOKENS_DIR.as_posix()}/",))
    errors = (
        _colour_literal_errors(repo_root)
        + _parity_errors(repo_root)
        + _undefined_reference_errors(repo_root)
        + _external_url_errors(repo_root)
    )
    return CheckResult(name="design-tokens", errors=tuple(errors))
