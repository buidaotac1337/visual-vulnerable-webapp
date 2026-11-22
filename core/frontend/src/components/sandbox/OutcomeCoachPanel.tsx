import { memo, useMemo, useState } from 'react';
import type { JSX } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { deriveOutcomeCoaching } from '@/lib';
import type { CoachCtaKind, OutcomeCoaching } from '@/lib';
import type { LabExecutionResponse, LabMode } from '@/types';

/** Props for the beginner-friendly OutcomeCoachPanel component. */
export interface OutcomeCoachPanelProps {
  mode: LabMode;
  response: LabExecutionResponse;
  hasFrontendSink?: boolean;
  onSwitchMode?: (mode: LabMode) => void;
  onOpenDiff?: () => void;
  onOpenVerify?: () => void;
}

interface ToneStyle {
  badge: string;
  box: string;
  cta: string;
  icon: JSX.Element;
}

const TONE_STYLES: Record<OutcomeCoaching['tone'], ToneStyle> = {
  danger: {
    badge: 'bg-danger-100 text-danger-700',
    box: 'border-danger-200 bg-danger-50/70 text-danger-900',
    cta: 'bg-danger-600 text-white hover:bg-danger-700',
    icon: <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />,
  },
  safe: {
    badge: 'bg-safe-100 text-safe-700',
    box: 'border-safe-200 bg-safe-50/70 text-safe-900',
    cta: 'bg-safe-600 text-white hover:bg-safe-700',
    icon: <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-safe-600" aria-hidden="true" />,
  },
  info: {
    badge: 'bg-slate-100 text-slate-700',
    box: 'border-info-200 bg-info-50/60 text-info-900',
    cta: 'bg-brand-600 text-white hover:bg-brand-700',
    icon: <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />,
  },
  warning: {
    badge: 'bg-warning-100 text-warning-800',
    box: 'border-warning-300 bg-warning-50/80 text-warning-900',
    cta: 'bg-warning-600 text-white hover:bg-warning-700',
    icon: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />,
  },
};

function resolveCtaHandler(
  ctaKind: CoachCtaKind | null,
  callbacks: Pick<OutcomeCoachPanelProps, 'onSwitchMode' | 'onOpenDiff' | 'onOpenVerify'>,
): (() => void) | null {
  if (ctaKind === 'switch-to-secure' && callbacks.onSwitchMode) {
    return () => callbacks.onSwitchMode?.('secure');
  }
  if (ctaKind === 'switch-to-vulnerable' && callbacks.onSwitchMode) {
    return () => callbacks.onSwitchMode?.('vulnerable');
  }
  if (ctaKind === 'open-diff' && callbacks.onOpenDiff) {
    return callbacks.onOpenDiff;
  }
  if (ctaKind === 'open-verify' && callbacks.onOpenVerify) {
    return callbacks.onOpenVerify;
  }
  return null;
}

/**
 * Render the system response card with a beginner-friendly outcome explanation,
 * an optional 1-click next-step CTA, and a collapsible raw JSON details panel.
 *
 * @param props - Active lab mode, execution response, and optional action callbacks.
 * @returns Rendered OutcomeCoachPanel card.
 */
function OutcomeCoachPanelInner({
  mode,
  response,
  hasFrontendSink = false,
  onSwitchMode,
  onOpenDiff,
  onOpenVerify,
}: OutcomeCoachPanelProps): JSX.Element {
  const [isJsonOpen, setIsJsonOpen] = useState(true);
  const coaching = deriveOutcomeCoaching(mode, response.meta.outcome, hasFrontendSink);
  const style = TONE_STYLES[coaching.tone];
  const formattedJson = useMemo(() => JSON.stringify(response.data, null, 2), [response.data]);
  const ctaHandler = resolveCtaHandler(coaching.ctaKind, {
    onSwitchMode,
    onOpenDiff,
    onOpenVerify,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Phản hồi từ hệ thống
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
          {coaching.badgeLabel}
        </span>
      </div>

      <div className={`rounded-lg border p-3 text-xs ${style.box}`}>
        <div className="flex items-start gap-2">
          {style.icon}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{coaching.headline}</p>
            <p className="mt-1 leading-relaxed opacity-90">{coaching.explanation}</p>
            {ctaHandler && coaching.ctaLabel && (
              <button
                type="button"
                onClick={ctaHandler}
                className={`mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${style.cta}`}
              >
                <span>{coaching.ctaLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          aria-expanded={isJsonOpen}
          onClick={() => setIsJsonOpen((prev) => !prev)}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {isJsonOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Chi tiết dữ liệu JSON</span>
        </button>

        {isJsonOpen && (
          <pre
            className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {formattedJson}
          </pre>
        )}
      </div>
    </div>
  );
}

/**
 * Memoized contextual outcome panel explaining execution results in plain Vietnamese
 * with a 1-click next-step CTA and memoized collapsible JSON output.
 */
export const OutcomeCoachPanel = memo(OutcomeCoachPanelInner);
