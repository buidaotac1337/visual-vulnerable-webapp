/**
 * Expectation matching semantics for Test My Fix (ADR-0006).
 *
 * TypeScript twin of core/backend/app/services/expect_matcher.py: both must keep
 * identical semantics, and both test suites share the same case lists.
 *
 * Every branch evaluates all of its children (no short-circuit), so a mistyped
 * operator anywhere in an expect block always throws, even while other assertions
 * in the same block are still failing.
 */

/** Raised when a verifyTests expect block uses an unknown or malformed operator. */
export class InvalidExpectationError extends Error {
  /**
   * Create a matcher configuration error.
   *
   * @param message - Human-readable diagnostic message.
   */
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidExpectationError';
  }
}

const OPERATOR_PREFIX = '$';

const STRING_OPERATORS: Record<string, (actual: string, operand: string) => boolean> = {
  $contains: (actual, operand) => actual.includes(operand),
  $notContains: (actual, operand) => !actual.includes(operand),
};

const MISSING = Symbol('missing');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const operatorKeys = keys.filter((key) => key.startsWith(OPERATOR_PREFIX));
  if (operatorKeys.length > 0 && operatorKeys.length !== keys.length) {
    throw new InvalidExpectationError(
      `Expect object mixes operators [${operatorKeys.sort().join(', ')}] with plain keys.`,
    );
  }
  return operatorKeys.length > 0;
}

function applyOperator(operator: string, operand: unknown, actual: unknown): boolean {
  const check = Object.hasOwn(STRING_OPERATORS, operator) ? STRING_OPERATORS[operator] : undefined;
  if (!check) {
    const supported = Object.keys(STRING_OPERATORS).sort().join(', ');
    throw new InvalidExpectationError(
      `Unknown expect operator '${operator}'; supported: ${supported}.`,
    );
  }
  if (typeof operand !== 'string') {
    throw new InvalidExpectationError(
      `Operator '${operator}' expects a string operand, got ${operand === null ? 'null' : typeof operand}.`,
    );
  }
  return typeof actual === 'string' && check(actual, operand);
}

function matchesObject(expected: Record<string, unknown>, actual: unknown): boolean {
  const container = isPlainObject(actual) ? actual : {};
  const outcomes = Object.entries(expected).map(([key, value]) =>
    matchesExpected(value, Object.hasOwn(container, key) ? container[key] : MISSING),
  );
  return isPlainObject(actual) && outcomes.every(Boolean);
}

function matchesArray(expected: readonly unknown[], actual: unknown): boolean {
  const items: readonly unknown[] = Array.isArray(actual) ? actual : [];
  const outcomes = expected.map((item, index) =>
    matchesExpected(item, index < items.length ? items[index] : MISSING),
  );
  return Array.isArray(actual) && items.length === expected.length && outcomes.every(Boolean);
}

/**
 * Check actual against expected with operators, subset objects, and strict booleans.
 *
 * Rules: an all-'$' object is an operator object (mixing '$' and plain keys is an
 * error); other objects match as recursive subsets; arrays need equal length and
 * pairwise matches; booleans compare by identity (true never equals 1); everything
 * else uses strict equality.
 *
 * @param expected - Expected value or nested structure from meta.json.
 * @param actual - Value produced by the lab (backend data or DOM observation).
 * @returns True when actual satisfies expected.
 * @throws InvalidExpectationError when an operator object is malformed anywhere in expected.
 */
export function matchesExpected(expected: unknown, actual: unknown): boolean {
  if (isOperatorObject(expected)) {
    const outcomes = Object.entries(expected).map(([op, operand]) =>
      applyOperator(op, operand, actual),
    );
    return outcomes.every(Boolean);
  }
  if (isPlainObject(expected)) {
    return matchesObject(expected, actual);
  }
  if (Array.isArray(expected)) {
    return matchesArray(expected, actual);
  }
  if (typeof expected === 'boolean' || typeof actual === 'boolean') {
    return expected === actual;
  }
  return actual !== MISSING && expected === actual;
}
