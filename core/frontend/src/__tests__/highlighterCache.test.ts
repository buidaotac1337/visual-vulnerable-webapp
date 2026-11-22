import { describe, expect, it } from 'vitest';

import { getCachedTokenLines, tokenizeCodeAsync } from '@/lib';

describe('Shiki highlighter LRU cache', () => {
  it('returns null before first tokenization, then serves identical cached token array synchronously', async () => {
    const sample = 'def demo_cache_hit(x: int) -> int:\n    return x + 1';
    expect(getCachedTokenLines(sample, 'python')).toBeNull();

    const first = await tokenizeCodeAsync(sample, 'python');
    expect(first.length).toBe(2);

    const syncHit = getCachedTokenLines(sample, 'python');
    expect(syncHit).toBe(first);

    const second = await tokenizeCodeAsync(sample, 'python');
    expect(second).toBe(first);
  });

  it('deduplicates concurrent tokenize requests for the same snippet', async () => {
    const sample = 'const concurrentCheck = (n: number): number => n * 2;';
    const [a, b] = await Promise.all([
      tokenizeCodeAsync(sample, 'tsx'),
      tokenizeCodeAsync(sample, 'tsx'),
    ]);
    expect(a).toBe(b);
    expect(getCachedTokenLines(sample, 'tsx')).toBe(a);
  });
});
