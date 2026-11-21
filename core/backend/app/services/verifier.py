"""Automated verification service powering the student 'Test My Fix' workflow."""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core import (
    ActionNotFoundError,
    InvalidActorError,
    InvalidExpectationError,
    InvalidLabIdError,
)
from app.db import LabDatabaseProtocol
from app.schemas import (
    BackendVerifyTest,
    LabExecutionResponse,
    VerifyLabResponse,
    VerifyTestResult,
)
from app.services.expect_matcher import matches_expected
from app.services.lab_discovery import get_lab_metadata
from app.services.lab_loader import execute_lab_action
from app.services.lab_response import LabActionRequest


@dataclass(frozen=True)
class _VerifyEnv:
    """Shared execution environment passed across verification helpers."""

    labs_dir: Path
    lab_id: str
    db: LabDatabaseProtocol
    upload_sandbox_dir: Path | None = None


def _fail_result(
    test_case: BackendVerifyTest,
    error: str,
    actual: dict[str, Any] | None = None,
) -> VerifyTestResult:
    """Construct a failed VerifyTestResult with consistent metadata."""
    return VerifyTestResult(
        name=test_case.name,
        action=test_case.action,
        passed=False,
        expected=test_case.expect,
        actual={} if actual is None else actual,
        error=error,
    )


def _extract_error(response: LabExecutionResponse) -> str:
    """Extract a readable diagnostic message from a failed LabExecutionResponse."""
    raw_error = response.data.get("error") or response.data.get("sql_error")
    return str(raw_error) if raw_error else "Lab handler reported an execution error."


def _is_error_response(response: LabExecutionResponse) -> bool:
    """Return True when a lab handler failed or emitted an error outcome."""
    return not response.ok or response.meta.outcome == "error"


async def _invoke(
    env: _VerifyEnv,
    action: str,
    payload: dict[str, Any],
    actor: str | None,
) -> LabExecutionResponse | str:
    """Invoke one lab action in vulnerable mode, catching lookup/actor errors."""
    action_req = LabActionRequest(
        lab_id=env.lab_id,
        mode="vulnerable",
        action=action,
        payload=payload,
        actor=actor,
    )
    try:
        return await execute_lab_action(
            env.labs_dir,
            action_req,
            env.db,
            upload_sandbox_dir=env.upload_sandbox_dir,
        )
    except (ActionNotFoundError, InvalidActorError, InvalidLabIdError) as exc:
        return str(exc)


def _grade_expect(test_case: BackendVerifyTest, actual: dict[str, Any]) -> VerifyTestResult:
    """Match actual output against test_case.expect and wrap into VerifyTestResult."""
    try:
        matched = matches_expected(test_case.expect, actual)
    except InvalidExpectationError as exc:
        return _fail_result(test_case, str(exc), actual)
    return VerifyTestResult(
        name=test_case.name,
        action=test_case.action,
        passed=matched,
        expected=test_case.expect,
        actual=actual,
    )


async def _run_check_action(
    env: _VerifyEnv,
    test_case: BackendVerifyTest,
) -> tuple[dict[str, Any] | None, str | None]:
    """Run optional post-test checkAction under the same actor to read DB state."""
    if test_case.check_action is None:
        return None, None
    outcome = await _invoke(env, test_case.check_action, test_case.check_input, test_case.actor)
    if isinstance(outcome, str):
        return None, outcome
    if _is_error_response(outcome):
        return outcome.data, _extract_error(outcome)
    return outcome.data, None


async def _run_single_test(env: _VerifyEnv, test_case: BackendVerifyTest) -> VerifyTestResult:
    """Execute a single-request test case with optional checkAction (ADR-0008)."""
    outcome = await _invoke(env, test_case.action, test_case.input, test_case.actor)
    if isinstance(outcome, str):
        return _fail_result(test_case, outcome)
    if _is_error_response(outcome):
        return _fail_result(test_case, _extract_error(outcome), outcome.data)

    check_data, check_error = await _run_check_action(env, test_case)
    has_check = test_case.check_action is not None
    actual = {**outcome.data, "check": check_data} if has_check else outcome.data
    if check_error is not None:
        failed_actual = actual if check_data is not None else outcome.data
        return _fail_result(test_case, check_error, failed_actual)
    return _grade_expect(test_case, actual)


async def _run_concurrent_test(env: _VerifyEnv, test_case: BackendVerifyTest) -> VerifyTestResult:
    """Fire N concurrent calls via asyncio.gather, aggregate outcomes, and check DB state."""
    tasks = [
        _invoke(env, test_case.action, test_case.input, test_case.actor)
        for _ in range(test_case.concurrency)
    ]
    raw_results = await asyncio.gather(*tasks)
    lookup_error = next((item for item in raw_results if isinstance(item, str)), None)
    if lookup_error is not None:
        return _fail_result(test_case, lookup_error)

    responses = [item for item in raw_results if isinstance(item, LabExecutionResponse)]
    outcomes: dict[str, int] = {"normal": 0, "exploited": 0, "blocked": 0, "error": 0}
    first_err: LabExecutionResponse | None = None
    for resp in responses:
        if _is_error_response(resp):
            outcomes["error"] += 1
            first_err = first_err or resp
        else:
            outcomes[resp.meta.outcome] += 1

    actual: dict[str, Any] = {
        "total": len(responses),
        "outcomes": outcomes,
        "responses": [resp.data for resp in responses],
        "check": None,
    }
    if first_err is not None:
        return _fail_result(test_case, _extract_error(first_err), actual)

    check_data, check_error = await _run_check_action(env, test_case)
    actual["check"] = check_data
    if check_error is not None:
        return _fail_result(test_case, check_error, actual)
    return _grade_expect(test_case, actual)


async def verify_lab(
    labs_dir: Path,
    lab_id: str,
    db: LabDatabaseProtocol,
    reset_fn: Callable[[], Awaitable[float]] | None = None,
    *,
    upload_sandbox_dir: Path | None = None,
) -> VerifyLabResponse:
    """Run backend verifyTests against vulnerable.py; frontend tests run in the browser.

    When `reset_fn` is provided, resets the database before each individual test
    case so stateful write labs remain isolated across assertions.

    Args:
        labs_dir: Root directory containing educational labs.
        lab_id: Lab identifier to verify.
        db: Restricted lab_app_user database adapter.
        reset_fn: Optional async callback to reset the database before each test.
        upload_sandbox_dir: Isolated upload sandbox directory from engine Settings.

    Returns:
        VerifyLabResponse summarizing aggregate pass status and per-test details.
    """
    metadata = get_lab_metadata(labs_dir, lab_id)
    env = _VerifyEnv(
        labs_dir=labs_dir,
        lab_id=lab_id,
        db=db,
        upload_sandbox_dir=upload_sandbox_dir,
    )
    results: list[VerifyTestResult] = []
    backend_tests = [t for t in metadata.verify_tests if isinstance(t, BackendVerifyTest)]
    for test_case in backend_tests:
        if reset_fn is not None:
            await reset_fn()
        runner = _run_concurrent_test if test_case.concurrency > 1 else _run_single_test
        results.append(await runner(env, test_case))

    passed_count = sum(1 for item in results if item.passed)
    return VerifyLabResponse(
        ok=True,
        lab_id=lab_id,
        passed=bool(results) and passed_count == len(results),
        total=len(results),
        passed_count=passed_count,
        results=results,
    )
