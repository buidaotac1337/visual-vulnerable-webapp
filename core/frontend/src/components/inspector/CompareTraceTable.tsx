import { memo } from 'react';
import type { JSX } from 'react';

import type { CompareRow, TraceStatus, TraceStep } from '@/types';

/** Props for the stage-aligned Song song trace table. */
export interface CompareTraceTableProps {
  rows: readonly CompareRow[];
  activeIndex: number;
  onSelectRow?: (index: number) => void;
}

const STATUS_DOT: Record<TraceStatus, string> = {
  info: 'bg-info-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  safe: 'bg-safe-500',
};

function StepCell({ step }: { step: TraceStep | null }): JSX.Element {
  if (!step) {
    return <span className="italic text-slate-500">— không có bước này</span>;
  }
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[step.status]}`}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words text-slate-200">{step.title}</span>
    </span>
  );
}

function CompareTraceTableInner({
  rows,
  activeIndex,
  onSelectRow,
}: CompareTraceTableProps): JSX.Element {
  return (
    <div className="border-b border-slate-700 text-xs">
      <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 bg-slate-900 px-3 py-1.5 font-semibold uppercase tracking-wide text-slate-400">
        <span>#</span>
        <span className="text-danger-300">Vulnerable</span>
        <span className="text-safe-300">Secure</span>
      </div>
      <ol aria-label="Trace Song song căn theo bước" className="max-h-56 overflow-auto">
        {rows.map((row, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={`${String(index)}-${row.layer}-${row.tag}`}>
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onSelectRow?.(index)}
                className={`grid w-full cursor-pointer grid-cols-[2rem_1fr_1fr] gap-2 border-l-2 px-3 py-1.5 text-left hover:bg-slate-800 ${
                  isActive ? 'border-brand-400 bg-slate-800' : 'border-transparent'
                }`}
              >
                <span className="text-slate-500" title={`${row.layer} · ${row.tag}`}>
                  {index + 1}
                </span>
                <StepCell step={row.vulnerable} />
                <StepCell step={row.secure} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Render the Song song trace as rows that pair each vulnerable step with the secure
 * step of the same layer and `@step` tag; clicking a row jumps playback to it.
 */
export const CompareTraceTable = memo(CompareTraceTableInner);
