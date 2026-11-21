/**
 * Expectation matching semantics for Test My Fix (ADR-0006).
 *
 * TypeScript twin of core/backend/app/services/expect_matcher.py: both must keep
 * identical semantics, and both test suites share the same case list.
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => key.startsWith(OPERATOR_PREFIX));
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
  return (
    isPlainObject(actual) &&
    Object.entries(expected).every(
      ([key, value]) => Object.hasOwn(actual, key) && matchesExpected(value, actual[key]),
    )
  );
}

/**
 * Check actual against expected with strict bools, operators, and subset objects.
 *
 * Rules: booleans compare by identity (true never equals 1); an all-'$' object is an
 * operator object; other objects match as recursive subsets; arrays need equal length
 * and pairwise matches; everything else uses strict equality.
 *
 * @param expected - Expected value or nested structure from meta.json.
 * @param actual - Value produced by the lab (backend data or DOM observation).
 * @returns True when actual satisfies expected.
 * @throws InvalidExpectationError when an operator object is malformed.
 */
export function matchesExpected(expected: unknown, actual: unknown): boolean {
  if (typeof expected === 'boolean' || typeof actual === 'boolean') {
    return expected === actual;
  }
  if (isOperatorObject(expected)) {
    // Evaluate every operator so an unknown one always surfaces, even after a miss.
    const outcomes = Object.entries(expected).map(([op, operand]) =>
      applyOperator(op, operand, actual),
    );
    return outcomes.every(Boolean);
  }
  if (isPlainObject(expected)) {
    return matchesObject(expected, actual);
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matchesExpected(item, actual[index]))
    );
  }
  return expected === actual;
}
