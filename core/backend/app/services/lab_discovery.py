"""Metadata discovery and validation for isolated VVWA labs."""

import json
import logging
from pathlib import Path

from pydantic import ValidationError

from app.core import InvalidLabIdError, LabNotFoundError
from app.schemas import LabMetadata
from app.services.source_reader import resolve_lab_dir, validate_lab_id

_LOGGER = logging.getLogger(__name__)


def _parse_lab_meta_file(meta_path: Path, expected_id: str) -> LabMetadata:
    """Read and validate one meta.json file ensuring its ID matches folder name.

    Args:
        meta_path: Path to labs/<id>/meta.json.
        expected_id: Directory name that must match metadata.id.

    Returns:
        Validated LabMetadata instance.

    Raises:
        ValueError: If metadata.id mismatches expected_id.
    """
    raw = json.loads(meta_path.read_text(encoding="utf-8"))
    metadata = LabMetadata.model_validate(raw)
    if metadata.id != expected_id:
        msg = f"meta.json id '{metadata.id}' does not match directory '{expected_id}'."
        raise ValueError(msg)
    return metadata


def discover_labs(labs_dir: Path) -> list[LabMetadata]:
    """Scan labs_dir for valid lab directories, skipping malformed meta.json safely.

    Args:
        labs_dir: Root directory containing educational labs.

    Returns:
        Sorted list of validated LabMetadata objects.
    """
    if not labs_dir.is_dir():
        return []
    discovered: list[LabMetadata] = []
    for entry in sorted(labs_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith((".", "_")):
            continue
        meta_path = entry / "meta.json"
        if not meta_path.is_file():
            continue
        try:
            validate_lab_id(entry.name)
            discovered.append(_parse_lab_meta_file(meta_path, entry.name))
        except (InvalidLabIdError, OSError, json.JSONDecodeError, ValidationError, ValueError) as e:
            _LOGGER.warning("Skipping invalid lab '%s': %s", entry.name, e)
    return discovered


def get_lab_metadata(labs_dir: Path, lab_id: str) -> LabMetadata:
    """Load and validate meta.json for a specific lab.

    Args:
        labs_dir: Root labs directory.
        lab_id: Lab identifier to load.

    Returns:
        Validated LabMetadata instance.

    Raises:
        LabNotFoundError: If meta.json is missing or invalid.
    """
    lab_dir = resolve_lab_dir(labs_dir, lab_id)
    meta_path = lab_dir / "meta.json"
    if not meta_path.is_file():
        msg = f"Lab metadata 'meta.json' not found for lab '{lab_id}'."
        raise LabNotFoundError(msg)
    try:
        return _parse_lab_meta_file(meta_path, lab_dir.name)
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as exc:
        msg = f"Invalid meta.json for lab '{lab_id}': {exc}"
        raise LabNotFoundError(msg) from exc
