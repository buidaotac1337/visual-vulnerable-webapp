"""Dynamic hot-reloading lab module loader and action executor for VVWA."""

import importlib.util
import inspect
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any
from uuid import uuid4

from app.core import ActionNotFoundError, InvalidLabIdError, LabNotFoundError
from app.db import LabDatabaseProtocol
from app.schemas import LabExecutionMeta, LabExecutionResponse, LabMode, TraceStep
from app.services.source_reader import resolve_lab_dir

_ACTION_NAME_PATTERN = re.compile(r"\A[a-z][a-z0-9_]*\Z")


@dataclass(frozen=True)
class LabActionRequest:
    """Parameter bundle describing a single lab action invocation.

    Attributes:
        lab_id: Kebab-case lab identifier.
        mode: Target implementation mode ('vulnerable' or 'secure').
        action: Public async function name inside the lab module.
        payload: JSON request body sent by the MiniShop Sandbox UI.
    """

    lab_id: str
    mode: LabMode
    action: str
    payload: dict[str, Any]


def validate_action_name(action: str) -> str:
    """Validate that an action name is a public snake_case Python identifier.

    Args:
        action: Candidate function name from URL path.

    Returns:
        Validated action identifier.

    Raises:
        InvalidLabIdError: If action starts with '_' or contains invalid chars/newlines.
    """
    if not _ACTION_NAME_PATTERN.match(action):
        msg = f"Invalid action name '{action}'; only public snake_case handlers are allowed."
        raise InvalidLabIdError(msg)
    return action


def _load_fresh_module(module_path: Path, lab_id: str, mode: LabMode) -> ModuleType:
    """Load a lab module directly from disk with temporary sys.modules registration.

    Temporarily registering under a unique module name allows `@dataclass` and
    Pydantic `BaseModel` with `from __future__ import annotations` to resolve
    forward references cleanly without leaking cached modules across reloads.

    Args:
        module_path: Path to vulnerable.py or secure.py.
        lab_id: Owning lab identifier.
        mode: Active lab mode.

    Returns:
        Freshly executed Python ModuleType reflecting latest disk edits.

    Raises:
        LabNotFoundError: If the module file does not exist or cannot form a spec.
    """
    if not module_path.is_file():
        msg = f"Lab handler file '{mode}.py' not found for lab '{lab_id}'."
        raise LabNotFoundError(msg)
    module_name = f"vvwa_lab_{lab_id.replace('-', '_')}_{mode}_{uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        msg = f"Unable to construct import spec for '{module_path}'."
        raise LabNotFoundError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    finally:
        sys.modules.pop(module_name, None)
    return module


def _normalize_trace(raw_trace: list[Any]) -> list[TraceStep]:
    """Validate trace dicts and enforce sequential 1-based step numbering.

    Args:
        raw_trace: Raw trace list returned by a lab handler.

    Returns:
        List of validated TraceStep models.

    Raises:
        TypeError: If any trace element is not a dictionary.
    """
    normalized: list[TraceStep] = []
    for index, item in enumerate(raw_trace, start=1):
        if not isinstance(item, dict):
            msg = f"Trace item at index {index - 1} must be a dict, got {type(item).__name__}."
            raise TypeError(msg)
        step_data = {**item, "step": index}
        normalized.append(TraceStep.model_validate(step_data))
    return normalized


def _error_execution_response(
    request: LabActionRequest,
    exc: Exception,
) -> LabExecutionResponse:
    """Build a structured educational error response for student-facing failures.

    Args:
        request: Original lab action request.
        exc: Exception raised while loading, executing, or validating handler output.

    Returns:
        LabExecutionResponse with ok=False and a single danger trace step.
    """
    error_type = type(exc).__name__
    detail = f"{error_type}: {exc}"
    return LabExecutionResponse(
        ok=False,
        data={"error": detail},
        meta=LabExecutionMeta(lab_id=request.lab_id, mode=request.mode, outcome="error"),
        trace=[
            TraceStep(
                step=1,
                layer="backend",
                tag="runtime-error",
                status="danger",
                title=f"Lỗi thực thi ({error_type})",
                detail=detail,
            ),
        ],
    )


def _build_execution_response(
    request: LabActionRequest,
    raw_result: object,
) -> LabExecutionResponse:
    """Validate and wrap a raw lab handler dictionary into LabExecutionResponse.

    Args:
        request: Original lab action request.
        raw_result: Value returned by the lab handler coroutine.

    Returns:
        Validated LabExecutionResponse (or structured error envelope if malformed).
    """
    if not isinstance(raw_result, dict):
        return _error_execution_response(
            request,
            TypeError("Lab handler must return a dict with 'data', 'meta', and 'trace'."),
        )
    try:
        raw_meta_val = raw_result.get("meta")
        raw_trace_val = raw_result.get("trace")
        raw_data_val = raw_result.get("data")
        raw_meta: dict[str, Any] = raw_meta_val if isinstance(raw_meta_val, dict) else {}
        raw_trace: list[Any] = raw_trace_val if isinstance(raw_trace_val, list) else []
        raw_data: dict[str, Any] = raw_data_val if isinstance(raw_data_val, dict) else {}
        return LabExecutionResponse(
            ok=True,
            data=raw_data,
            meta=LabExecutionMeta(
                lab_id=request.lab_id,
                mode=request.mode,
                outcome=raw_meta.get("outcome", "normal"),
            ),
            trace=_normalize_trace(raw_trace),
        )
    except Exception as exc:
        return _error_execution_response(request, exc)


async def execute_lab_action(
    labs_dir: Path,
    request: LabActionRequest,
    db: LabDatabaseProtocol,
) -> LabExecutionResponse:
    """Dynamically load and execute an async lab handler against the app DB.

    Args:
        labs_dir: Root directory containing educational labs.
        request: LabActionRequest specifying lab_id, mode, action, and payload.
        db: Restricted lab_app_user database adapter.

    Returns:
        Normalized LabExecutionResponse with data, meta, and sequential trace.

    Raises:
        InvalidLabIdError: If lab_id or action name is invalid.
        LabNotFoundError: If lab directory or handler file does not exist.
        ActionNotFoundError: If the requested async action does not exist.
    """
    lab_dir = resolve_lab_dir(labs_dir, request.lab_id)
    safe_action = validate_action_name(request.action)
    module_path = lab_dir / "backend" / f"{request.mode}.py"

    try:
        module = _load_fresh_module(module_path, request.lab_id, request.mode)
    except LabNotFoundError:
        raise
    except Exception as exc:
        return _error_execution_response(request, exc)

    handler = getattr(module, safe_action, None)
    if handler is None or not inspect.iscoroutinefunction(handler):
        msg = f"Async action '{safe_action}' not found in '{request.lab_id}/{request.mode}.py'."
        raise ActionNotFoundError(msg)

    try:
        raw_result = await handler(request.payload, db)
    except Exception as exc:
        return _error_execution_response(request, exc)

    return _build_execution_response(request, raw_result)
