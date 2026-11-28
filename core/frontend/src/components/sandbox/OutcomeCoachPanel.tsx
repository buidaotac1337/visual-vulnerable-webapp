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
import type { LucideIcon } from 'lucide-react';

import { deriveOutcomeCoaching, toneClasses, TRACE_STATUS_TONE } from '@/lib';
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

const TONE_ICONS: Record<OutcomeCoaching['tone'], LucideIcon> = {
  danger: ShieldAlert,
  safe: ShieldCheck,
  info: Info,
  warning: AlertTriangle,
};

/** Coach colours come from the trace-status tone (lib/tones.ts, ADR-0012). */
function toneStyle(tone: OutcomeCoaching['tone']): ToneStyle {
  const classes = toneClasses(TRACE_STATUS_TONE[tone]);
  const Icon = TONE_ICONS[tone];
  return {
    badge: `${classes.bgSubtler} ${classes.text}`,
    box: `${classes.borderSubtle} ${classes.bg} ${classes.textBolder}`,
    cta: `${classes.bgBold} ${classes.onBold} ${classes.bgBoldHovered}`,
    icon: <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${classes.icon}`} aria-hidden="true" />,
  };
}

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
  const style = toneStyle(coaching.tone);
  const formattedJson = useMemo(() => JSON.stringify(response.data, null, 2), [response.data]);
  const ctaHandler = resolveCtaHandler(coaching.ctaKind, {
    onSwitchMode,
    onOpenDiff,
    onOpenVerify,
  });

  return (
    <div className="rounded-xlarge border border-default bg-surface-raised p-3.5 shadow-raised">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-subtlest">
          Phản hồi từ hệ thống
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
          {coaching.badgeLabel}
        </span>
      </div>

      <div className={`rounded-large border p-3 text-xs ${style.box}`}>
        <div className="flex items-start gap-2">
          {style.icon}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{coaching.headline}</p>
            <p className="mt-1 leading-relaxed opacity-90">{coaching.explanation}</p>
            {ctaHandler && coaching.ctaLabel && (
              <button
                type="button"
                onClick={ctaHandler}
                className={`mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-large px-3 py-1.5 text-xs font-semibold transition-colors ${style.cta}`}
              >
                <span>{coaching.ctaLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 border-t border-default pt-2">
        <button
          type="button"
          aria-expanded={isJsonOpen}
          onClick={() => setIsJsonOpen((prev) => !prev)}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-subtle hover:text-default"
        >
          {isJsonOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Chi tiết dữ liệu JSON</span>
        </button>

        {isJsonOpen && (
          <pre className="mt-2 overflow-x-auto rounded-large bg-surface-sunken p-3 text-xs text-default font-mono">
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
