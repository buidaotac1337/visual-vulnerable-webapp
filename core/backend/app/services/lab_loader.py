"""Dynamic hot-reloading lab module loader and action executor for VVWA."""

import importlib.util
import inspect
import re
import sys
from collections.abc import Callable
from pathlib import Path
from types import ModuleType
from typing import Any
from uuid import uuid4

from app.core import ActionNotFoundError, InvalidLabIdError, LabNotFoundError
from app.db import LabDatabaseProtocol
from app.schemas import LabContext, LabExecutionResponse, LabMode
from app.services.lab_response import (
    LabActionRequest,
    build_execution_response,
    error_execution_response,
)
from app.services.session_actor import build_session_trace_step, resolve_lab_context
from app.services.source_reader import resolve_lab_dir

_ACTION_NAME_PATTERN = re.compile(r"\A[a-z][a-z0-9_]*\Z")
_CTX_PARAM_KINDS = (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)


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


def _accepts_ctx(handler: Callable[..., Any]) -> bool:
    """Return True when a lab handler opts into the engine session via a `ctx` parameter.

    Only parameters that accept a keyword argument count, because the engine
    always passes `ctx=...`; positional-only, `*ctx`, and `**ctx` are ignored.

    Args:
        handler: Async lab handler function.

    Returns:
        True if the handler declares a keyword-capable parameter named `ctx`.
    """
    try:
        param = inspect.signature(handler).parameters.get("ctx")
    except (TypeError, ValueError):
        return False
    return param is not None and param.kind in _CTX_PARAM_KINDS


async def _run_handler(
    handler: Callable[..., Any],
    request: LabActionRequest,
    db: LabDatabaseProtocol,
    *,
    upload_sandbox_dir: Path | None = None,
) -> LabExecutionResponse:
    """Invoke a lab handler, injecting LabContext only when it declares `ctx`.

    Args:
        handler: Async lab handler function.
        request: Original lab action request carrying payload and actor.
        db: Restricted lab_app_user database adapter.
        upload_sandbox_dir: Isolated upload sandbox directory from engine Settings.

    Returns:
        Normalized LabExecutionResponse or a structured runtime-error envelope.

    Raises:
        InvalidActorError: If the session header names an unknown persona.
    """
    engine_steps: list[dict[str, Any]] = []
    ctx: LabContext | None = None
    if _accepts_ctx(handler):
        ctx = await resolve_lab_context(
            db,
            request.actor,
            upload_sandbox_dir=upload_sandbox_dir,
        )
        engine_steps.append(build_session_trace_step(ctx))
    try:
        if ctx is None:
            raw_result = await handler(request.payload, db)
        else:
            raw_result = await handler(request.payload, db, ctx=ctx)
    except Exception as exc:
        return error_execution_response(request, exc)
    return build_execution_response(request, raw_result, engine_steps)


async def execute_lab_action(
    labs_dir: Path,
    request: LabActionRequest,
    db: LabDatabaseProtocol,
    *,
    upload_sandbox_dir: Path | None = None,
) -> LabExecutionResponse:
    """Dynamically load and execute an async lab handler against the app DB.

    Args:
        labs_dir: Root directory containing educational labs.
        request: LabActionRequest specifying lab_id, mode, action, and payload.
        db: Restricted lab_app_user database adapter.
        upload_sandbox_dir: Isolated upload sandbox directory from engine Settings.

    Returns:
        Normalized LabExecutionResponse with data, meta, and sequential trace.

    Raises:
        InvalidLabIdError: If lab_id or action name is invalid.
        LabNotFoundError: If lab directory or handler file does not exist.
        ActionNotFoundError: If the requested async action does not exist.
        InvalidActorError: If a ctx-aware handler receives an unknown session actor.
    """
    lab_dir = resolve_lab_dir(labs_dir, request.lab_id)
    safe_action = validate_action_name(request.action)
    module_path = lab_dir / "backend" / f"{request.mode}.py"

    try:
        module = _load_fresh_module(module_path, request.lab_id, request.mode)
    except LabNotFoundError:
        raise
    except Exception as exc:
        return error_execution_response(request, exc)

    handler = getattr(module, safe_action, None)
    if handler is None or not inspect.iscoroutinefunction(handler):
        msg = f"Async action '{safe_action}' not found in '{request.lab_id}/{request.mode}.py'."
        raise ActionNotFoundError(msg)

    return await _run_handler(
        handler,
        request,
        db,
        upload_sandbox_dir=upload_sandbox_dir,
    )
