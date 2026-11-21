import { describe, expect, it } from 'vitest';

import { InvalidExpectationError, matchesExpected } from '@/lib';

// Mirrored from core/backend/tests/test_frontend_sink_pair.py MATCHER_CASES — keep identical.
const MATCHER_CASES: [unknown, unknown, boolean][] = [
  [true, true, true],
  [true, 1, false],
  [false, 0, false],
  [1, 1, true],
  ['a', 'a', true],
  [null, null, true],
  [{ a: 1 }, { a: 1, b: 2 }, true],
  [{ a: 1 }, { b: 1 }, false],
  [{ a: { b: true } }, { a: { b: true, c: 0 } }, true],
  [[1, 2], [1, 2], true],
  [[1], [1, 2], false],
  [{ $contains: '<img' }, '&lt;img <img', true],
  [{ $contains: '<img' }, '&lt;img', false],
  [{ $notContains: '<img' }, '&lt;img src=x&gt;', true],
  [{ $notContains: '<img' }, '<img src=x>', false],
  [{ $contains: 'a', $notContains: 'b' }, 'abc', false],
  [{ $contains: 'x' }, 5, false],
  [{ $notContains: 'x' }, null, false],
  [{ text: { $contains: 'hi' } }, { text: 'oh hi' }, true],
  [{}, { anything: 1 }, true],
];

describe('expectMatcher (TypeScript twin of expect_matcher.py)', () => {
  it.each(MATCHER_CASES)('matches(%j, %j) === %s', (expected, actual, result) => {
    expect(matchesExpected(expected, actual)).toBe(result);
  });

  it.each([[{ $regex: 'x' }], [{ $contains: 1 }], [{ $notContains: 'zzz', $bogus: 'x' }]])(
    'rejects unknown or malformed operator %j',
    (expected) => {
      expect(() => matchesExpected(expected, 'zzz')).toThrow(InvalidExpectationError);
    },
  );

  it('does not treat inherited keys as present', () => {
    expect(matchesExpected({ toString: 1 }, {})).toBe(false);
    expect(() => matchesExpected({ $toString: 'x' }, 'x')).toThrow(InvalidExpectationError);
  });
});
