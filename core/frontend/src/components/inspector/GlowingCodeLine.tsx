import { memo } from 'react';
import type { JSX, RefObject } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { toneClasses, TRACE_STATUS_TONE } from '@/lib';

import type { CodeToken, TraceLayer, TraceStatus, TraceStep } from '@/types';

interface GlowingCodeLineProps {
  lineNumber: number;
  tokens: readonly CodeToken[];
  activeStep: TraceStep | null;
  rowRef?: RefObject<HTMLDivElement | null>;
}

interface StatusTheme {
  label: string;
  badge: string;
  border: string;
  bg: string;
  glow: string;
  calloutBorder: string;
  calloutText: string;
  icon: JSX.Element;
}

const LAYER_LABELS: Record<TraceLayer, string> = {
  frontend: 'MiniShop UI',
  backend: 'FastAPI Backend',
  database: 'PostgreSQL DB',
};

const STATUS_LABELS: Record<TraceStatus, string> = {
  danger: 'Lỗ hổng kích hoạt',
  safe: 'Đã chặn an toàn',
  warning: 'Cảnh báo rủi ro',
  info: 'Xử lý bình thường',
};

const STATUS_ICONS: Record<TraceStatus, LucideIcon> = {
  danger: AlertOctagon,
  safe: ShieldCheck,
  warning: AlertTriangle,
  info: Info,
};

/** Line glow colours come from the status tone (lib/tones.ts, ADR-0012). */
function statusTheme(status: TraceStatus): StatusTheme {
  const tone = TRACE_STATUS_TONE[status];
  const classes = toneClasses(tone);
  const Icon = STATUS_ICONS[status];
  return {
    label: STATUS_LABELS[status],
    badge: `${classes.borderSubtle} ${classes.bgSubtler} ${classes.textBolder}`,
    border: `border-l-[3px] ${classes.borderLeft}`,
    bg: classes.bg,
    // --vv-glow-* is re-declared per colour-mode scope, so it follows the Inspector's dark scope.
    glow: `var(--vv-glow-${tone})`,
    calloutBorder: `${classes.borderSubtle} ${classes.bg}`,
    calloutText: classes.textBolder,
    icon: <Icon className={`h-4 w-4 shrink-0 ${classes.icon}`} aria-hidden="true" />,
  };
}

/**
 * Render one source code line from XSS-safe Shiki tokens, lighting up with a semantic
 * status glow and slide-down Inline Callout Box when its @step is active.
 *
 * @param props - 1-based lineNumber, tokenized spans, optional activeStep, and scroll ref.
 * @returns Rendered code line with optional inline pedagogical callout.
 */
function GlowingCodeLineInner({
  lineNumber,
  tokens,
  activeStep,
  rowRef,
}: GlowingCodeLineProps): JSX.Element {
  const theme = activeStep ? statusTheme(activeStep.status) : null;

  return (
    <div ref={rowRef} data-line-number={lineNumber}>
      <div
        className={`flex items-baseline px-3 py-0.5 leading-code transition-colors duration-150 ${
          theme ? `${theme.border} ${theme.bg}` : 'border-l-[3px] border-l-transparent'
        }`}
        style={theme ? { boxShadow: theme.glow } : undefined}
      >
        <span className="mr-4 w-8 shrink-0 select-none text-right text-xs text-subtle">
          {lineNumber}
        </span>
        <span className="whitespace-pre text-code text-default">
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
          className={`vvwa-callout-animate mx-4 my-2 rounded-large border p-3 text-xs ${theme.calloutBorder} ${theme.calloutText}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
            <div className="flex items-center gap-2">
              {theme.icon}
              <span>
                Bước {activeStep.step}: {activeStep.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-medium">
              <span className="rounded-full border border-default bg-surface px-2 py-0.5 text-micro text-default">
                {LAYER_LABELS[activeStep.layer]}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-micro ${theme.badge}`}>
                {theme.label}
              </span>
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words rounded-small bg-surface px-2.5 py-1.5 text-body-small text-default font-mono">
            {activeStep.detail}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Memoized single source code line from XSS-safe Shiki tokens, lighting up with a semantic
 * status glow and slide-down Inline Callout Box when its @step is active.
 */
export const GlowingCodeLine = memo(GlowingCodeLineInner);
