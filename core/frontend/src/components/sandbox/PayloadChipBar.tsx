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
 * @param props - Sample payloads from meta.json and selection handler.
 * @returns Rendered PayloadChipBar section, or null when no sample payloads exist.
 */
export function PayloadChipBar({ payloads, onSelect }: PayloadChipBarProps): JSX.Element | null {
  if (payloads.length === 0) {
    return null;
  }

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
            onClick={() => onSelect(sample)}
            className="cursor-pointer rounded-full border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:border-indigo-500 hover:bg-indigo-100"
          >
            {sample.label}
            {sample.actor ? (
              <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-600">
                vai {sample.actor}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
