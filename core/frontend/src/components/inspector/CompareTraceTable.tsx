import { memo } from 'react';
import type { JSX } from 'react';

import { statusToneClasses } from '@/lib';
import type { CompareRow, TraceStep } from '@/types';

/** Props for the stage-aligned Song song trace table. */
export interface CompareTraceTableProps {
  rows: readonly CompareRow[];
  activeIndex: number;
  onSelectRow?: (index: number) => void;
}

function StepCell({ step }: { step: TraceStep | null }): JSX.Element {
  if (!step) {
    return <span className="italic text-subtlest">— không có bước này</span>;
  }
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusToneClasses(step.status).bgBold}`}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words text-default">{step.title}</span>
    </span>
  );
}

function CompareTraceTableInner({
  rows,
  activeIndex,
  onSelectRow,
}: CompareTraceTableProps): JSX.Element {
  return (
    <div className="border-b border-default text-xs">
      <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 bg-surface px-3 py-1.5 font-semibold uppercase tracking-wide text-subtle">
        <span>#</span>
        <span className="text-danger">Vulnerable</span>
        <span className="text-success">Secure</span>
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
                className={`grid w-full cursor-pointer grid-cols-[2rem_1fr_1fr] gap-2 border-l-2 px-3 py-1.5 text-left hover:bg-neutral-hovered ${
                  isActive ? 'border-brand bg-neutral' : 'border-transparent'
                }`}
              >
                <span className="text-subtlest" title={`${row.layer} · ${row.tag}`}>
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
