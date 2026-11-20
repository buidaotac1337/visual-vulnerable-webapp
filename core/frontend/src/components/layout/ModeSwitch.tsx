import type { JSX } from 'react';
import { Bug, ShieldCheck } from 'lucide-react';

import type { LabMode } from '@/types';

interface ModeSwitchProps {
  mode: LabMode;
  onChange: (nextMode: LabMode) => void;
}

/**
 * Render the Vulnerable <-> Secure segmented control with semantic security tokens.
 *
 * @param props - Active lab mode and change callback.
 * @returns Accessible radiogroup segmented control element.
 */
export function ModeSwitch({ mode, onChange }: ModeSwitchProps): JSX.Element {
  const isVuln = mode === 'vulnerable';

  return (
    <div
      role="radiogroup"
      aria-label="Chế độ thực thi bài lab"
      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={isVuln}
        onClick={() => onChange('vulnerable')}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
          isVuln
            ? 'border-red-500 bg-red-50 text-red-700 shadow-xs'
            : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
        }`}
      >
        <Bug className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Vulnerable</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={!isVuln}
        onClick={() => onChange('secure')}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
          !isVuln
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
            : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
        }`}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Secure</span>
      </button>
    </div>
  );
}
