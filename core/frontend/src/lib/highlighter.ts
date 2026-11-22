import { createHighlighterCore } from 'shiki/core';
import type { HighlighterCore, LanguageRegistration } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import type { CodeToken, HighlightLanguage } from '@/types';

const IDE_THEME = 'github-dark-default';
const MAX_CACHE_ENTRIES = 64;

type LangLoader = () => Promise<{ default: LanguageRegistration[] }>;

const LANG_LOADERS: Record<HighlightLanguage, LangLoader> = {
  python: () => import('shiki/langs/python.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLangs = new Map<HighlightLanguage, Promise<void>>();
const tokenCache = new Map<string, CodeToken[][]>();
const inflightTokenize = new Map<string, Promise<CodeToken[][]>>();

function cacheKey(code: string, language: HighlightLanguage): string {
  return `${language}\0${code}`;
}

function writeTokenCache(key: string, lines: CodeToken[][]): void {
  if (tokenCache.has(key)) {
    tokenCache.delete(key);
  } else if (tokenCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = tokenCache.keys().next().value;
    if (oldestKey !== undefined) {
      tokenCache.delete(oldestKey);
    }
  }
  tokenCache.set(key, lines);
}

async function getHighlighterFor(language: HighlightLanguage): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import('shiki/themes/github-dark-default.mjs')],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  const highlighter = await highlighterPromise;
  let langReady = loadedLangs.get(language);
  if (!langReady) {
    langReady = LANG_LOADERS[language]().then((mod) => highlighter.loadLanguage(mod.default));
    loadedLangs.set(language, langReady);
  }
  await langReady;
  return highlighter;
}

/**
 * Look up previously tokenized Shiki lines synchronously so switching tabs or
 * toggling Vulnerable/Secure paints colored code on the first frame with zero flash.
 *
 * @param code - Source snippet text.
 * @param language - Target grammar ('python', 'tsx', or 'sql').
 * @returns Cached token lines, or `null` when not yet tokenized.
 */
export function getCachedTokenLines(
  code: string,
  language: HighlightLanguage,
): CodeToken[][] | null {
  if (code.length === 0) {
    return [];
  }
  const key = cacheKey(code, language);
  const hit = tokenCache.get(key);
  if (!hit) {
    return null;
  }
  // Refresh LRU recency.
  tokenCache.delete(key);
  tokenCache.set(key, hit);
  return hit;
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
 * Tokenize source code using fine-grained shiki/core with lazy per-language grammar
 * loading, in-flight deduplication, and an LRU cache into XSS-safe React token lines.
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
  const cached = getCachedTokenLines(code, language);
  if (cached !== null) {
    return cached;
  }
  const key = cacheKey(code, language);
  const pending = inflightTokenize.get(key);
  if (pending) {
    return pending;
  }

  const job = (async (): Promise<CodeToken[][]> => {
    try {
      const highlighter = await getHighlighterFor(language);
      const { tokens } = highlighter.codeToTokens(code, {
        lang: language,
        theme: IDE_THEME,
      });
      const lines = tokens.map((line) =>
        line.map((token) =>
          token.color ? { content: token.content, color: token.color } : { content: token.content },
        ),
      );
      writeTokenCache(key, lines);
      return lines;
    } catch {
      return tokenizeCodeSyncFallback(code);
    } finally {
      inflightTokenize.delete(key);
    }
  })();

  inflightTokenize.set(key, job);
  return job;
}
