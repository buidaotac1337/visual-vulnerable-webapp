import { createHighlighterCore } from 'shiki/core';
import type { HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import type { CodeToken, HighlightLanguage } from '@/types';

const IDE_THEME = 'github-dark-default';

let highlighterPromise: Promise<HighlighterCore> | null = null;

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import('shiki/themes/github-dark-default.mjs')],
      langs: [
        import('shiki/langs/python.mjs'),
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/sql.mjs'),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

/**
 * Produce an instant synchronous token-per-line fallback before Shiki resolves
 * (also guarantees zero-jank initial paint and synchronous Vitest jsdom rendering).
 *
 * @param code - Raw source text to split into plain single-token lines.
 * @returns Two-dimensional token array aligned 1:1 with code lines.
 */
export function tokenizeCodeSyncFallback(code: string): CodeToken[][] {
  if (code.length === 0) {
    return [];
  }
  return code.split('\n').map((line) => [{ content: line }]);
}

/**
 * Tokenize source code using fine-grained shiki/core into XSS-safe React token lines.
 * Falls back gracefully to plain tokens if the grammar engine cannot initialize.
 *
 * @param code - Source snippet text.
 * @param language - Target grammar ('python', 'tsx', or 'sql').
 * @returns Promise resolving to line-indexed CodeToken arrays.
 */
export async function tokenizeCodeAsync(
  code: string,
  language: HighlightLanguage,
): Promise<CodeToken[][]> {
  if (code.length === 0) {
    return [];
  }
  try {
    const highlighter = await getHighlighter();
    const { tokens } = highlighter.codeToTokens(code, {
      lang: language,
      theme: IDE_THEME,
    });
    return tokens.map((line) =>
      line.map((token) =>
        token.color ? { content: token.content, color: token.color } : { content: token.content },
      ),
    );
  } catch {
    return tokenizeCodeSyncFallback(code);
  }
}
