"""Lab action request bundle and normalization of handler output into LabExecutionResponse."""

from dataclasses import dataclass
from typing import Any

from app.schemas import LabExecutionMeta, LabExecutionResponse, LabMode, TraceStep
from app.services.session_actor import ENGINE_TAG_PREFIX


@dataclass(frozen=True)
class LabActionRequest:
    """Parameter bundle describing a single lab action invocation.

    Attributes:
        lab_id: Kebab-case lab identifier.
        mode: Target implementation mode ('vulnerable' or 'secure').
        action: Public async function name inside the lab module.
        payload: JSON request body sent by the MiniShop Sandbox UI (untrusted).
        actor: Persona username from the X-VVWA-Actor session header (trusted), if any.
    """

    lab_id: str
    mode: LabMode
    action: str
    payload: dict[str, Any]
    actor: str | None = None


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


def error_execution_response(
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


def _reject_engine_tags(raw_trace: list[Any]) -> None:
    """Refuse lab-emitted trace tags that impersonate engine-generated steps.

    Args:
        raw_trace: Raw trace list returned by a lab handler.

    Raises:
        ValueError: If any step tag starts with the reserved engine- prefix.
    """
    for item in raw_trace:
        tag = item.get("tag") if isinstance(item, dict) else None
        if isinstance(tag, str) and tag.startswith(ENGINE_TAG_PREFIX):
            msg = f"Trace tag '{tag}' uses the reserved '{ENGINE_TAG_PREFIX}' prefix."
            raise ValueError(msg)


def build_execution_response(
    request: LabActionRequest,
    raw_result: object,
    engine_steps: list[dict[str, Any]] | None = None,
) -> LabExecutionResponse:
    """Validate and wrap a raw lab handler dictionary into LabExecutionResponse.

    Args:
        request: Original lab action request.
        raw_result: Value returned by the lab handler coroutine.
        engine_steps: Engine-generated steps placed before the handler's own trace.

    Returns:
        Validated LabExecutionResponse (or structured error envelope if malformed).
    """
    if not isinstance(raw_result, dict):
        return error_execution_response(
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
        _reject_engine_tags(raw_trace)
        return LabExecutionResponse(
            ok=True,
            data=raw_data,
            meta=LabExecutionMeta(
                lab_id=request.lab_id,
                mode=request.mode,
                outcome=raw_meta.get("outcome", "normal"),
            ),
            trace=_normalize_trace([*(engine_steps or []), *raw_trace]),
        )
    except Exception as exc:
        return error_execution_response(request, exc)
