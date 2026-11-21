import { useState } from 'react';
import type { JSX } from 'react';
import { Sparkles } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { SamplePayload } from '@/types';

interface PayloadChipBarProps {
  payloads: readonly SamplePayload[];
  onSelect: (sample: SamplePayload) => void;
}

/**
 * Render 1-click dashed pill chips for pre-filling pedagogical payloads into the sandbox.
 *
 * The description of the last picked chip is shown as visible text under the row,
 * so keyboard and touch users can read it too (not only as a hover tooltip).
 *
 * @param props - Sample payloads from meta.json and selection handler.
 * @returns Rendered PayloadChipBar section, or null when no sample payloads exist.
 */
export function PayloadChipBar({ payloads, onSelect }: PayloadChipBarProps): JSX.Element | null {
  const [picked, setPicked] = useState<string | null>(null);
  if (payloads.length === 0) {
    return null;
  }
  const description = payloads.find((sample) => sample.label === picked)?.description;

  return (
    // relative: keeps the always-mounted sr-only live region inside this card.
    <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
        <span>{UI_LABELS.payloads.text}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {payloads.map((sample) => (
          <button
            key={sample.label}
            type="button"
            title={sample.description}
            aria-pressed={picked === sample.label}
            onClick={() => {
              setPicked(sample.label);
              onSelect(sample);
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium text-brand-700 transition-colors hover:border-brand-500 hover:bg-brand-100 ${
              picked === sample.label
                ? 'border-solid border-brand-500 bg-brand-100'
                : 'border-dashed border-brand-300 bg-brand-50/50'
            }`}
          >
            {sample.label}
            {sample.actor ? (
              <span className="ml-1.5 rounded-full bg-white/80 px-1.5 text-xs text-brand-700">
                vai {sample.actor}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Always mounted, so screen readers announce the first description too. */}
      <p aria-live="polite" className={description ? 'mt-2 text-xs text-slate-600' : 'sr-only'}>
        {description ?? ''}
      </p>
    </div>
  );
}
