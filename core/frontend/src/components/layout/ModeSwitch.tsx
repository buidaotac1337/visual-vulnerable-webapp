import type { JSX } from 'react';
import { Bug, ShieldCheck } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { LabMode } from '@/types';

import { Tooltip } from '../ui';

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
      <Tooltip tip={UI_LABELS.vulnerable.tip}>
        <button
          type="button"
          role="radio"
          aria-checked={isVuln}
          onClick={() => onChange('vulnerable')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
            isVuln
              ? 'border-danger-500 bg-danger-50 text-danger-700 shadow-xs'
              : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bug className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{UI_LABELS.vulnerable.text}</span>
        </button>
      </Tooltip>

      <Tooltip tip={UI_LABELS.secure.tip}>
        <button
          type="button"
          role="radio"
          aria-checked={!isVuln}
          onClick={() => onChange('secure')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
            !isVuln
              ? 'border-safe-500 bg-safe-50 text-safe-700 shadow-xs'
              : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{UI_LABELS.secure.text}</span>
        </button>
      </Tooltip>
    </div>
  );
}
