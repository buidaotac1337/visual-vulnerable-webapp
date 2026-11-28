import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  getCachedTokenLines,
  statusToneClasses,
  tokenizeCodeAsync,
  tokenizeCodeSyncFallback,
} from '@/lib';
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

const UNMAPPED_ICONS: Record<TraceStatus, LucideIcon> = {
  danger: AlertOctagon,
  warning: AlertTriangle,
  safe: ShieldCheck,
  info: Info,
};

/** Callout colours for steps without a mapped line come from the status tone (ADR-0012). */
function themeForUnmappedStep(status: TraceStatus): UnmappedTheme {
  const classes = statusToneClasses(status);
  const Icon = UNMAPPED_ICONS[status];
  return {
    box: `${classes.border} ${classes.bg} ${classes.textBolder}`,
    heading: classes.text,
    icon: <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />,
  };
}

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
    activeStep !== null && highlightedLine === null
      ? themeForUnmappedStep(activeStep.status)
      : null;

  return (
    <div className="flex flex-col py-2 font-mono">
      {unmappedTheme && activeStep && (
        <div
          role="status"
          className={`vvwa-callout-animate mx-4 mb-3 rounded-large border p-3 text-xs ${unmappedTheme.box}`}
        >
          <div className={`flex items-center gap-2 font-semibold ${unmappedTheme.heading}`}>
            {unmappedTheme.icon}
            <span>
              Bước {activeStep.step}: {activeStep.title}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words rounded-small bg-surface px-2.5 py-1.5 text-body-small">
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
