import { describe, expect, it } from 'vitest';

import { parseUnifiedDiff } from '@/lib';

describe('parseUnifiedDiff', () => {
  it('returns an empty array when diff text is empty or whitespace', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
    expect(parseUnifiedDiff('   \n  ')).toEqual([]);
  });

  it('parses unified diff hunks with accurate old and new line numbers', () => {
    const rawDiff = [
      '--- vulnerable.py',
      '+++ secure.py',
      '@@ -1,3 +1,3 @@',
      ' async def login(payload, db):',
      '-    sql = f"SELECT {u}"',
      '+    sql = "SELECT $1"',
      '     return sql',
    ].join('\n');

    const rows = parseUnifiedDiff(rawDiff);
    expect(rows).toEqual([
      { kind: 'hunk', oldLine: null, newLine: null, content: '@@ -1,3 +1,3 @@' },
      { kind: 'context', oldLine: 1, newLine: 1, content: 'async def login(payload, db):' },
      { kind: 'remove', oldLine: 2, newLine: null, content: '    sql = f"SELECT {u}"' },
      { kind: 'add', oldLine: null, newLine: 2, content: '    sql = "SELECT $1"' },
      { kind: 'context', oldLine: 3, newLine: 3, content: '    return sql' },
    ]);
  });
});
