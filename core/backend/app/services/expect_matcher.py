"""Expectation matching semantics for Test My Fix (ADR-0006).

The TypeScript twin lives in core/frontend/src/lib and must keep identical
semantics; both test suites share the same case list.
"""

from collections.abc import Callable
from typing import Any

from app.core import InvalidExpectationError

OPERATOR_PREFIX = "$"

_STRING_OPERATORS: dict[str, Callable[[str, str], bool]] = {
    "$contains": lambda actual, operand: operand in actual,
    "$notContains": lambda actual, operand: operand not in actual,
}


def _is_operator_object(expected: object) -> bool:
    """Return True for a non-empty dict whose keys all start with '$'.

    Args:
        expected: Value taken from a verifyTests expect block.

    Returns:
        True when the dict must be interpreted as matcher operators.
    """
    return (
        isinstance(expected, dict)
        and bool(expected)
        and all(isinstance(key, str) and key.startswith(OPERATOR_PREFIX) for key in expected)
    )


def _apply_operator(operator: str, operand: object, actual: object) -> bool:
    """Evaluate one matcher operator against an actual value.

    Args:
        operator: Operator key such as '$contains'.
        operand: Operator argument from meta.json.
        actual: Value produced by the lab.

    Returns:
        True when the actual value satisfies the operator.

    Raises:
        InvalidExpectationError: If the operator is unknown or its operand is not a string.
    """
    check = _STRING_OPERATORS.get(operator)
    if check is None:
        msg = f"Unknown expect operator '{operator}'; supported: {sorted(_STRING_OPERATORS)}."
        raise InvalidExpectationError(msg)
    if not isinstance(operand, str):
        msg = f"Operator '{operator}' expects a string operand, got {type(operand).__name__}."
        raise InvalidExpectationError(msg)
    return isinstance(actual, str) and check(actual, operand)


def matches_expected(expected: Any, actual: Any) -> bool:  # noqa: ANN401
    """Check actual against expected with strict bools, operators, and subset dicts.

    Rules: bools compare by identity (True never equals 1); an all-'$' dict is an
    operator object; other dicts match as recursive subsets; lists need equal
    length and pairwise matches; everything else uses equality.

    Args:
        expected: Expected value or nested structure from meta.json.
        actual: Value produced by the lab.

    Returns:
        True when actual satisfies expected.

    Raises:
        InvalidExpectationError: If an operator object is malformed.
    """
    if isinstance(expected, bool) or isinstance(actual, bool):
        return isinstance(expected, bool) and isinstance(actual, bool) and expected is actual
    if _is_operator_object(expected):
        # Evaluate every operator so an unknown one always surfaces, even after a miss.
        outcomes = [_apply_operator(op, operand, actual) for op, operand in expected.items()]
        return all(outcomes)
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            key in actual and matches_expected(val, actual[key]) for key, val in expected.items()
        )
    if isinstance(expected, list):
        return (
            isinstance(actual, list)
            and len(expected) == len(actual)
            and all(matches_expected(e, a) for e, a in zip(expected, actual, strict=True))
        )
    return bool(actual == expected)
