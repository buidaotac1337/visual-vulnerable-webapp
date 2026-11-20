"""Automated verification service powering the student 'Test My Fix' workflow."""

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from app.core import ActionNotFoundError, InvalidLabIdError
from app.db import LabDatabaseProtocol
from app.schemas import VerifyLabResponse, VerifyTestCase, VerifyTestResult
from app.services.lab_discovery import get_lab_metadata
from app.services.lab_loader import LabActionRequest, execute_lab_action


def _matches_value(expected: Any, actual: Any) -> bool:  # noqa: ANN401
    """Compare expected and actual values with strict bool typing and recursive dicts.

    Avoids Python's `True == 1` / `False == 0` pitfall and performs subset matching
    recursively for nested dictionaries.

    Args:
        expected: Expected value or nested subset structure from meta.json.
        actual: Actual value returned inside response.data.

    Returns:
        True when actual strictly satisfies expected.
    """
    if isinstance(expected, bool) or isinstance(actual, bool):
        return isinstance(expected, bool) and isinstance(actual, bool) and expected is actual
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        return all(
            key in actual and _matches_value(val, actual[key]) for key, val in expected.items()
        )
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) != len(actual):
            return False
        return all(
            _matches_value(exp_item, act_item)
            for exp_item, act_item in zip(expected, actual, strict=True)
        )
    return bool(actual == expected)


async def _run_single_test(
    labs_dir: Path,
    lab_id: str,
    test_case: VerifyTestCase,
    db: LabDatabaseProtocol,
) -> VerifyTestResult:
    """Execute one verification test case against a lab's vulnerable.py handler.

    Args:
        labs_dir: Root labs directory.
        lab_id: Identifier of the lab under test.
        test_case: Test assertion from meta.json verifyTests.
        db: Restricted lab_app_user database adapter.

    Returns:
        VerifyTestResult describing pass/fail outcome and diagnostics.
    """
    action_req = LabActionRequest(
        lab_id=lab_id,
        mode="vulnerable",
        action=test_case.action,
        payload=test_case.input,
    )
    try:
        response = await execute_lab_action(labs_dir, action_req, db)
    except (ActionNotFoundError, InvalidLabIdError) as exc:
        return VerifyTestResult(
            name=test_case.name,
            action=test_case.action,
            passed=False,
            expected=test_case.expect,
            actual={},
            error=str(exc),
        )

    if not response.ok:
        error_msg = str(response.data.get("error", "Lab handler execution failed."))
        return VerifyTestResult(
            name=test_case.name,
            action=test_case.action,
            passed=False,
            expected=test_case.expect,
            actual=response.data,
            error=error_msg,
        )

    matched = _matches_value(test_case.expect, response.data)
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
) -> VerifyLabResponse:
    """Run all verifyTests defined in meta.json against vulnerable.py.

    When `reset_fn` is provided, resets the database before each individual test
    case so stateful write labs remain isolated across assertions.

    Args:
        labs_dir: Root directory containing educational labs.
        lab_id: Lab identifier to verify.
        db: Restricted lab_app_user database adapter.
        reset_fn: Optional async callback to reset the database before each test.

    Returns:
        VerifyLabResponse summarizing aggregate pass status and per-test details.
    """
    metadata = get_lab_metadata(labs_dir, lab_id)
    results: list[VerifyTestResult] = []
    for test_case in metadata.verify_tests:
        if reset_fn is not None:
            await reset_fn()
        results.append(await _run_single_test(labs_dir, lab_id, test_case, db))

    passed_count = sum(1 for item in results if item.passed)
    return VerifyLabResponse(
        ok=True,
        lab_id=lab_id,
        passed=bool(results) and passed_count == len(results),
        total=len(results),
        passed_count=passed_count,
        results=results,
    )
