"""Expectation matching semantics for Test My Fix (ADR-0006).

The TypeScript twin lives in core/frontend/src/lib/expectMatcher.ts and must keep
identical semantics; both test suites share the same case lists.

Every branch evaluates all of its children (no short-circuit), so a mistyped
operator anywhere in an expect block always raises, even while other assertions
in the same block are still failing.
"""

from collections.abc import Callable
from typing import Any

from app.core import InvalidExpectationError

OPERATOR_PREFIX = "$"

_STRING_OPERATORS: dict[str, Callable[[str, str], bool]] = {
    "$contains": lambda actual, operand: operand in actual,
    "$notContains": lambda actual, operand: operand not in actual,
}

_MISSING = object()


def _is_operator_object(expected: object) -> bool:
    """Return True for a non-empty dict whose keys all start with '$'.

    Args:
        expected: Value taken from a verifyTests expect block.

    Returns:
        True when the dict must be interpreted as matcher operators.

    Raises:
        InvalidExpectationError: If the dict mixes '$' operators with plain keys.
    """
    if not isinstance(expected, dict) or not expected:
        return False
    operator_keys = [k for k in expected if isinstance(k, str) and k.startswith(OPERATOR_PREFIX)]
    if operator_keys and len(operator_keys) != len(expected):
        msg = f"Expect object mixes operators {sorted(operator_keys)} with plain keys."
        raise InvalidExpectationError(msg)
    return bool(operator_keys)


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


def _matches_dict(expected: dict[Any, Any], actual: object) -> bool:
    """Subset-match a dict, evaluating every expected key even when one already failed.

    Args:
        expected: Expected subset.
        actual: Value produced by the lab.

    Returns:
        True when actual is a dict containing every expected key with a matching value.
    """
    container = actual if isinstance(actual, dict) else {}
    outcomes = [
        matches_expected(val, container.get(key, _MISSING)) for key, val in expected.items()
    ]
    return isinstance(actual, dict) and all(outcomes)


def _matches_list(expected: list[Any], actual: object) -> bool:
    """Match a list pairwise, evaluating every expected item even when one already failed.

    Args:
        expected: Expected list.
        actual: Value produced by the lab.

    Returns:
        True when actual is a list of equal length whose items all match.
    """
    items = actual if isinstance(actual, list) else []
    outcomes = [
        matches_expected(item, items[i] if i < len(items) else _MISSING)
        for i, item in enumerate(expected)
    ]
    return isinstance(actual, list) and len(items) == len(expected) and all(outcomes)


def matches_expected(expected: Any, actual: Any) -> bool:  # noqa: ANN401
    """Check actual against expected with operators, subset dicts, and strict bools.

    Rules: an all-'$' dict is an operator object (mixing '$' and plain keys is an
    error); other dicts match as recursive subsets; lists need equal length and
    pairwise matches; bools compare by identity (True never equals 1); everything
    else uses equality.

    Args:
        expected: Expected value or nested structure from meta.json.
        actual: Value produced by the lab.

    Returns:
        True when actual satisfies expected.

    Raises:
        InvalidExpectationError: If an operator object is malformed anywhere in expected.
    """
    if _is_operator_object(expected):
        outcomes = [_apply_operator(op, operand, actual) for op, operand in expected.items()]
        return all(outcomes)
    if isinstance(expected, dict):
        return _matches_dict(expected, actual)
    if isinstance(expected, list):
        return _matches_list(expected, actual)
    if isinstance(expected, bool) or isinstance(actual, bool):
        return isinstance(expected, bool) and isinstance(actual, bool) and expected is actual
    return actual is not _MISSING and bool(actual == expected)
