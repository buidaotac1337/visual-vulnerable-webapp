"""Public barrel exports for VVWA backend domain services."""

from app.services.lab_discovery import discover_labs, get_lab_metadata
from app.services.lab_loader import (
    LabActionRequest,
    execute_lab_action,
    validate_action_name,
)
from app.services.source_reader import (
    build_snippet_zip,
    generate_unified_diff,
    parse_snippet_source,
    read_lab_source,
    resolve_lab_dir,
    validate_lab_id,
)
from app.services.verifier import verify_lab

__all__ = [
    "LabActionRequest",
    "build_snippet_zip",
    "discover_labs",
    "execute_lab_action",
    "generate_unified_diff",
    "get_lab_metadata",
    "parse_snippet_source",
    "read_lab_source",
    "resolve_lab_dir",
    "validate_action_name",
    "validate_lab_id",
    "verify_lab",
]
