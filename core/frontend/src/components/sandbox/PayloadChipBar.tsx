import { memo, useState } from 'react';
import type { JSX } from 'react';
import { CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

import { classifySamplePayload, UI_LABELS } from '@/lib';
import type { PayloadIntent } from '@/lib';
import type { SamplePayload } from '@/types';

interface PayloadChipBarProps {
  payloads: readonly SamplePayload[];
  onSelect: (sample: SamplePayload) => void;
}

const CHIP_STYLE: Record<PayloadIntent, { idle: string; picked: string; iconClass: string }> = {
  attack: {
    idle: 'border-dashed border-danger-300 bg-danger-50/40 text-danger-800 hover:border-danger-500 hover:bg-danger-100',
    picked: 'border-solid border-danger-500 bg-danger-100 text-danger-900',
    iconClass: 'text-danger-600',
  },
  normal: {
    idle: 'border-dashed border-safe-300 bg-safe-50/40 text-safe-800 hover:border-safe-500 hover:bg-safe-100',
    picked: 'border-solid border-safe-500 bg-safe-100 text-safe-900',
    iconClass: 'text-safe-600',
  },
};

/**
 * Render 1-click dashed pill chips for pre-filling pedagogical payloads into the sandbox,
 * visually distinguishing attack attempts from normal legitimate flows.
 *
 * The description of the last picked chip is shown as visible text under the row,
 * so keyboard and touch users can read it too (not only as a hover tooltip).
 *
 * @param props - Sample payloads from meta.json and selection handler.
 * @returns Rendered PayloadChipBar section, or null when no sample payloads exist.
 */
function PayloadChipBarInner({ payloads, onSelect }: PayloadChipBarProps): JSX.Element | null {
  const [picked, setPicked] = useState<string | null>(null);
  if (payloads.length === 0) {
    return null;
  }
  const description = payloads.find((sample) => sample.label === picked)?.description;

  return (
    // relative: keeps the always-mounted sr-only live region inside this card.
    <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          <span>{UI_LABELS.payloads.text}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-danger-500" aria-hidden="true" />
            Thử tấn công
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-safe-500" aria-hidden="true" />
            Luồng hợp lệ
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {payloads.map((sample) => {
          const intent = classifySamplePayload(sample);
          const style = CHIP_STYLE[intent];
          const isPicked = picked === sample.label;

          return (
            <button
              key={sample.label}
              type="button"
              aria-pressed={isPicked}
              onClick={() => {
                setPicked(sample.label);
                onSelect(sample);
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isPicked ? style.picked : style.idle
              }`}
            >
              {intent === 'attack' ? (
                <ShieldAlert
                  className={`h-3.5 w-3.5 shrink-0 ${style.iconClass}`}
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${style.iconClass}`}
                  aria-hidden="true"
                />
              )}
              <span>{sample.label}</span>
              {sample.actor ? (
                <span className="rounded-full bg-white/80 px-1.5 text-xs text-slate-700">
                  vai {sample.actor}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Always mounted, so screen readers announce the first description too. */}
      <p aria-live="polite" className={description ? 'mt-2 text-xs text-slate-600' : 'sr-only'}>
        {description ?? ''}
      </p>
      {description ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Đã điền vào biểu mẫu — hãy bấm nút gửi ở trên để xem kết quả.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Memoized 1-click sample payload chip bar visually distinguishing attacks vs normal flows.
 */
export const PayloadChipBar = memo(PayloadChipBarInner);
