"""Pydantic schemas for automated Test My Fix verification results."""

from typing import Any

from pydantic import BaseModel, Field


class VerifyTestResult(BaseModel):
    """Outcome of one verification test case from meta.json.

    Attributes:
        name: Human-readable test case label.
        action: Lab handler action that was invoked.
        passed: Whether all expected fields matched and the handler succeeded.
        expected: Subset of expected key-value pairs.
        actual: Actual data dictionary returned by the lab handler.
        error: Optional runtime error string if execution failed.
    """

    name: str
    action: str
    passed: bool
    expected: dict[str, Any]
    actual: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class VerifyLabResponse(BaseModel):
    """Aggregate result returned by POST /api/labs/{lab_id}/verify.

    Attributes:
        ok: True when verification completed execution.
        lab_id: Identifier of the verified lab.
        passed: True only when all verification test cases passed.
        total: Total number of test cases executed.
        passed_count: Number of test cases that passed.
        results: Per-test detailed diagnostic results.
    """

    ok: bool = True
    lab_id: str
    passed: bool
    total: int
    passed_count: int
    results: list[VerifyTestResult]
