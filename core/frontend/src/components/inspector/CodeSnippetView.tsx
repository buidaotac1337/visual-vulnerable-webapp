import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck } from 'lucide-react';

import { getCachedTokenLines, tokenizeCodeAsync, tokenizeCodeSyncFallback } from '@/lib';
import type { CodeToken, HighlightLanguage, TraceStatus, TraceStep } from '@/types';

import { GlowingCodeLine } from './GlowingCodeLine';

interface CodeSnippetViewProps {
  code: string;
  language: HighlightLanguage;
  highlightedLine: number | null;
  activeStep: TraceStep | null;
}

interface UnmappedTheme {
  box: string;
  heading: string;
  icon: JSX.Element;
}

const UNMAPPED_THEMES: Record<TraceStatus, UnmappedTheme> = {
  danger: {
    box: 'border-danger-500/60 bg-danger-950/80 text-danger-100',
    heading: 'text-danger-300',
    icon: <AlertOctagon className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  warning: {
    box: 'border-warning-500/60 bg-warning-950/80 text-warning-100',
    heading: 'text-warning-300',
    icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  safe: {
    box: 'border-safe-500/60 bg-safe-950/80 text-safe-100',
    heading: 'text-safe-300',
    icon: <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  info: {
    box: 'border-info-500/60 bg-info-950/80 text-info-100',
    heading: 'text-info-300',
    icon: <Info className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
};

interface AsyncTokenState {
  key: string;
  lines: CodeToken[][];
}

function CodeSnippetViewInner({
  code,
  language,
  highlightedLine,
  activeStep,
}: CodeSnippetViewProps): JSX.Element {
  const snippetKey = `${language}\0${code}`;
  const cachedTokens = getCachedTokenLines(code, language);
  const [asyncTokens, setAsyncTokens] = useState<AsyncTokenState | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (getCachedTokenLines(code, language) !== null) {
      return undefined;
    }
    let cancelled = false;
    void tokenizeCodeAsync(code, language).then((resolved) => {
      if (!cancelled) {
        setAsyncTokens({ key: snippetKey, lines: resolved });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, language, snippetKey]);

  const fallbackTokens = useMemo(() => tokenizeCodeSyncFallback(code), [code]);
  const tokenLines =
    cachedTokens ?? (asyncTokens?.key === snippetKey ? asyncTokens.lines : fallbackTokens);

  useEffect(() => {
    const node = activeRowRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [highlightedLine, activeStep?.step]);

  const unmappedTheme =
    activeStep !== null && highlightedLine === null ? UNMAPPED_THEMES[activeStep.status] : null;

  return (
    <div className="flex flex-col py-2" style={{ fontFamily: 'var(--font-mono)' }}>
      {unmappedTheme && activeStep && (
        <div
          role="status"
          className={`vvwa-callout-animate mx-4 mb-3 rounded-lg border p-3 text-xs ${unmappedTheme.box}`}
        >
          <div className={`flex items-center gap-2 font-semibold ${unmappedTheme.heading}`}>
            {unmappedTheme.icon}
            <span>
              Bước {activeStep.step}: {activeStep.title}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words rounded bg-slate-950/70 px-2.5 py-1.5 text-[12px]">
            {activeStep.detail}
          </p>
        </div>
      )}

      {tokenLines.map((tokens, index) => {
        const lineNumber = index + 1;
        const isHighlighted = highlightedLine === lineNumber && activeStep !== null;
        return (
          <GlowingCodeLine
            key={lineNumber}
            lineNumber={lineNumber}
            tokens={tokens}
            activeStep={isHighlighted ? activeStep : null}
            rowRef={isHighlighted ? activeRowRef : undefined}
          />
        );
      })}
    </div>
  );
}

/**
 * Render a syntax-highlighted source snippet with 1-based line numbers, zero-flash LRU
 * Shiki caching, auto-scrolling to the active @step line, and unmapped step callouts.
 *
 * @param props - Source text, Shiki grammar language, resolved line number, and activeStep.
 * @returns Memoized IDE code block element.
 */
export const CodeSnippetView = memo(CodeSnippetViewInner);
