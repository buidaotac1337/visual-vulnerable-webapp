import { useState } from 'react';
import type { JSX } from 'react';
import { Sparkles } from 'lucide-react';

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
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
        <span>Payload mẫu (1-click điền sẵn)</span>
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
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:border-indigo-500 hover:bg-indigo-100 ${
              picked === sample.label
                ? 'border-solid border-indigo-500 bg-indigo-100'
                : 'border-dashed border-indigo-300 bg-indigo-50/50'
            }`}
          >
            {sample.label}
            {sample.actor ? (
              <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-700">
                vai {sample.actor}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {description ? (
        <p aria-live="polite" className="mt-2 text-xs text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}
