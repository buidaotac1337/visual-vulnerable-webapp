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
    border: 'border-l-[3px] border-l-danger-500',
    bg: 'bg-danger-500/16',
    glow: 'inset 0 0 12px rgba(239, 68, 68, 0.22)',
    calloutBorder: 'border-danger-500/50 bg-danger-950/75',
    calloutText: 'text-danger-200',
    icon: <AlertOctagon className="h-4 w-4 shrink-0 text-danger-400" aria-hidden="true" />,
  },
  safe: {
    border: 'border-l-[3px] border-l-safe-500',
    bg: 'bg-safe-500/16',
    glow: 'inset 0 0 12px rgba(16, 185, 129, 0.22)',
    calloutBorder: 'border-safe-500/50 bg-safe-950/75',
    calloutText: 'text-safe-200',
    icon: <ShieldCheck className="h-4 w-4 shrink-0 text-safe-400" aria-hidden="true" />,
  },
  warning: {
    border: 'border-l-[3px] border-l-warning-500',
    bg: 'bg-warning-500/16',
    glow: 'inset 0 0 12px rgba(245, 158, 11, 0.22)',
    calloutBorder: 'border-warning-500/50 bg-warning-950/75',
    calloutText: 'text-warning-200',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-warning-400" aria-hidden="true" />,
  },
  info: {
    border: 'border-l-[3px] border-l-info-500',
    bg: 'bg-info-500/16',
    glow: 'inset 0 0 12px rgba(59, 130, 246, 0.22)',
    calloutBorder: 'border-info-500/50 bg-info-950/75',
    calloutText: 'text-info-200',
    icon: <Info className="h-4 w-4 shrink-0 text-info-400" aria-hidden="true" />,
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
        <span className="mr-4 w-8 shrink-0 select-none text-right text-xs text-slate-400">
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
