"""Isolated filesystem sandbox and outer jail for upload-based labs (ADR-0007)."""

import shutil
from pathlib import Path

MAX_SANDBOX_UPLOAD_BYTES = 512 * 1024
DEFAULT_WEBROOT_INDEX = "<!doctype html><title>MiniShop</title><h1>MiniShop Home</h1>\n"


def _resolve_path(path: Path) -> Path:
    """Resolve a filesystem path, converting OS/null-byte errors into ValueError."""
    try:
        return path.resolve()
    except (OSError, ValueError, RuntimeError) as exc:
        msg = f"Invalid sandbox target path '{path}': {exc}"
        raise ValueError(msg) from exc


def ensure_upload_sandbox(sandbox_dir: Path) -> tuple[Path, Path]:
    """Create the simulated webroot and uploads folder and seed webroot/index.html.

    Args:
        sandbox_dir: Root directory of the isolated upload sandbox.

    Returns:
        Tuple of resolved `(webroot_dir, uploads_dir)` paths.
    """
    root = _resolve_path(sandbox_dir)
    webroot_dir = root / "webroot"
    uploads_dir = webroot_dir / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    index_path = webroot_dir / "index.html"
    if not index_path.exists():
        index_path.write_text(DEFAULT_WEBROOT_INDEX, encoding="utf-8")
    return webroot_dir, uploads_dir


def write_within_sandbox_jail(sandbox_dir: Path, target_path: Path, data: bytes) -> Path:
    """Write bytes only when target_path resolves strictly inside sandbox_dir.

    This outer jail protects host volume mounts (`./labs`, `./core/backend/app`)
    while still allowing narrow inner-sandbox escapes (such as `../index.html`
    from `webroot/uploads/` into `webroot/`) in `vulnerable.py` for demonstration.

    Args:
        sandbox_dir: Outer jail root directory (from `Settings.upload_sandbox_dir`).
        target_path: Candidate destination path computed by the lab handler.
        data: Raw file bytes to write (capped at `MAX_SANDBOX_UPLOAD_BYTES`).

    Returns:
        Resolved absolute path where the file was written.

    Raises:
        ValueError: If payload exceeds size ceiling, escapes jail, or targets a directory.
    """
    if len(data) > MAX_SANDBOX_UPLOAD_BYTES:
        msg = f"Payload exceeds {MAX_SANDBOX_UPLOAD_BYTES} byte engine upload ceiling."
        raise ValueError(msg)

    sandbox_root = _resolve_path(sandbox_dir)
    sandbox_root.mkdir(parents=True, exist_ok=True)
    resolved_target = _resolve_path(target_path)

    if resolved_target == sandbox_root or not resolved_target.is_relative_to(sandbox_root):
        msg = f"Target path '{resolved_target}' escapes upload sandbox jail."
        raise ValueError(msg)

    webroot_dir = sandbox_root / "webroot"
    uploads_dir = webroot_dir / "uploads"
    if resolved_target in {webroot_dir, uploads_dir} or resolved_target.is_dir():
        msg = f"Target path '{resolved_target}' points to a directory, not a file."
        raise ValueError(msg)

    resolved_target.parent.mkdir(parents=True, exist_ok=True)
    resolved_target.write_bytes(data)
    return resolved_target


def reset_upload_sandbox(sandbox_dir: Path) -> None:
    """Remove all uploaded/overwritten files inside sandbox_dir and re-seed webroot.

    Args:
        sandbox_dir: Outer jail root directory to clean and reinitialize.
    """
    root = _resolve_path(sandbox_dir)
    if root.exists():
        for child in root.iterdir():
            if child.is_symlink() or not child.is_dir():
                child.unlink(missing_ok=True)
            else:
                shutil.rmtree(child)
    ensure_upload_sandbox(root)
