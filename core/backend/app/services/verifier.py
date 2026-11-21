"""Automated verification service powering the student 'Test My Fix' workflow."""

from collections.abc import Awaitable, Callable
from pathlib import Path

from app.core import (
    ActionNotFoundError,
    InvalidActorError,
    InvalidExpectationError,
    InvalidLabIdError,
)
from app.db import LabDatabaseProtocol
from app.schemas import BackendVerifyTest, VerifyLabResponse, VerifyTestResult
from app.services.expect_matcher import matches_expected
from app.services.lab_discovery import get_lab_metadata
from app.services.lab_loader import execute_lab_action
from app.services.lab_response import LabActionRequest


async def _run_single_test(
    labs_dir: Path,
    lab_id: str,
    test_case: BackendVerifyTest,
    db: LabDatabaseProtocol,
    *,
    upload_sandbox_dir: Path | None = None,
) -> VerifyTestResult:
    """Execute one verification test case against a lab's vulnerable.py handler.

    Args:
        labs_dir: Root labs directory.
        lab_id: Identifier of the lab under test.
        test_case: Test assertion from meta.json verifyTests.
        db: Restricted lab_app_user database adapter.
        upload_sandbox_dir: Isolated upload sandbox directory from engine Settings.

    Returns:
        VerifyTestResult describing pass/fail outcome and diagnostics.
    """
    action_req = LabActionRequest(
        lab_id=lab_id,
        mode="vulnerable",
        action=test_case.action,
        payload=test_case.input,
        actor=test_case.actor,
    )
    try:
        response = await execute_lab_action(
            labs_dir,
            action_req,
            db,
            upload_sandbox_dir=upload_sandbox_dir,
        )
    except (ActionNotFoundError, InvalidActorError, InvalidLabIdError) as exc:
        return VerifyTestResult(
            name=test_case.name,
            action=test_case.action,
            passed=False,
            expected=test_case.expect,
            actual={},
            error=str(exc),
        )

    if not response.ok or response.meta.outcome == "error":
        raw_error = response.data.get("error") or response.data.get("sql_error")
        error_msg = str(raw_error) if raw_error else "Lab handler reported an execution error."
        return VerifyTestResult(
            name=test_case.name,
            action=test_case.action,
            passed=False,
            expected=test_case.expect,
            actual=response.data,
            error=error_msg,
        )

    try:
        matched = matches_expected(test_case.expect, response.data)
    except InvalidExpectationError as exc:
        return VerifyTestResult(
            name=test_case.name,
            action=test_case.action,
            passed=False,
            expected=test_case.expect,
            actual=response.data,
            error=str(exc),
        )
    return VerifyTestResult(
        name=test_case.name,
        action=test_case.action,
        passed=matched,
        expected=test_case.expect,
        actual=response.data,
    )


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
    results: list[VerifyTestResult] = []
    backend_tests = [t for t in metadata.verify_tests if isinstance(t, BackendVerifyTest)]
    for test_case in backend_tests:
        if reset_fn is not None:
            await reset_fn()
        results.append(
            await _run_single_test(
                labs_dir,
                lab_id,
                test_case,
                db,
                upload_sandbox_dir=upload_sandbox_dir,
            ),
        )

    passed_count = sum(1 for item in results if item.passed)
    return VerifyLabResponse(
        ok=True,
        lab_id=lab_id,
        passed=bool(results) and passed_count == len(results),
        total=len(results),
        passed_count=passed_count,
        results=results,
    )
