import type { JSX, RefObject } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck } from 'lucide-react';

import type { CodeToken, TraceStatus, TraceStep } from '@/types';

interface GlowingCodeLineProps {
  lineNumber: number;
  tokens: readonly CodeToken[];
  activeStep: TraceStep | null;
  rowRef?: RefObject<HTMLDivElement | null>;
}

interface StatusTheme {
  border: string;
  bg: string;
  glow: string;
  calloutBorder: string;
  calloutText: string;
  icon: JSX.Element;
}

const STATUS_THEMES: Record<TraceStatus, StatusTheme> = {
  danger: {
    border: 'border-l-[3px] border-l-red-500',
    bg: 'bg-red-500/16',
    glow: 'inset 0 0 12px rgba(239, 68, 68, 0.22)',
    calloutBorder: 'border-red-500/50 bg-red-950/75',
    calloutText: 'text-red-200',
    icon: <AlertOctagon className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />,
  },
  safe: {
    border: 'border-l-[3px] border-l-emerald-500',
    bg: 'bg-emerald-500/16',
    glow: 'inset 0 0 12px rgba(16, 185, 129, 0.22)',
    calloutBorder: 'border-emerald-500/50 bg-emerald-950/75',
    calloutText: 'text-emerald-200',
    icon: <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />,
  },
  warning: {
    border: 'border-l-[3px] border-l-amber-500',
    bg: 'bg-amber-500/16',
    glow: 'inset 0 0 12px rgba(245, 158, 11, 0.22)',
    calloutBorder: 'border-amber-500/50 bg-amber-950/75',
    calloutText: 'text-amber-200',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />,
  },
  info: {
    border: 'border-l-[3px] border-l-blue-500',
    bg: 'bg-blue-500/16',
    glow: 'inset 0 0 12px rgba(59, 130, 246, 0.22)',
    calloutBorder: 'border-blue-500/50 bg-blue-950/75',
    calloutText: 'text-blue-200',
    icon: <Info className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />,
  },
};

/**
 * Render one source code line from XSS-safe Shiki tokens, lighting up with a semantic
 * status glow and slide-down Inline Callout Box when its @step is active.
 *
 * @param props - 1-based lineNumber, tokenized spans, optional activeStep, and scroll ref.
 * @returns Rendered code line with optional inline pedagogical callout.
 */
export function GlowingCodeLine({
  lineNumber,
  tokens,
  activeStep,
  rowRef,
}: GlowingCodeLineProps): JSX.Element {
  const theme = activeStep ? STATUS_THEMES[activeStep.status] : null;

  return (
    <div ref={rowRef} data-line-number={lineNumber}>
      <div
        className={`flex items-baseline px-3 py-0.5 leading-[22px] transition-colors duration-150 ${
          theme ? `${theme.border} ${theme.bg}` : 'border-l-[3px] border-l-transparent'
        }`}
        style={theme ? { boxShadow: theme.glow } : undefined}
      >
        <span className="mr-4 w-8 shrink-0 select-none text-right text-xs text-slate-500">
          {lineNumber}
        </span>
        <span className="whitespace-pre text-[13px] text-slate-200">
          {tokens.length === 0
            ? ' '
            : tokens.map((token, idx) => (
                <span key={idx} style={token.color ? { color: token.color } : undefined}>
                  {token.content}
                </span>
              ))}
        </span>
      </div>

      {activeStep && theme && (
        <div
          role="note"
          className={`vvwa-callout-animate mx-4 my-2 rounded-lg border p-3 text-xs ${theme.calloutBorder} ${theme.calloutText}`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {theme.icon}
            <span>
              Bước {activeStep.step}: {activeStep.title}
            </span>
          </div>
          <p
            className="mt-1.5 break-all rounded bg-slate-950/70 px-2.5 py-1.5 text-[12px] text-slate-100"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {activeStep.detail}
          </p>
        </div>
      )}
    </div>
  );
}
