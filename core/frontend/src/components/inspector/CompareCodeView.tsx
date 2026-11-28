import { memo } from 'react';
import type { JSX } from 'react';

import { toneClasses, TRACE_OUTCOME_LABELS, TRACE_OUTCOME_TONE, UI_LABELS } from '@/lib';
import type {
  CompareRow,
  CompareRunResult,
  LabMode,
  LabSourceResponse,
  TraceOutcome,
  TraceStep,
} from '@/types';

import { CodeSnippetView } from './CodeSnippetView';
import { CompareTraceTable } from './CompareTraceTable';

/** Props for the Song song backend view of the Code Inspector. */
export interface CompareCodeViewProps {
  source: LabSourceResponse;
  result: CompareRunResult | null;
  activeIndex: number;
  onSelectRow?: (index: number) => void;
}

const SIDES: readonly { side: LabMode; file: string; headingClass: string }[] = [
  { side: 'vulnerable', file: 'vulnerable.py', headingClass: 'text-danger' },
  { side: 'secure', file: 'secure.py', headingClass: 'text-success' },
];

/** Outcome badge colours come from the outcome tone (lib/tones.ts, ADR-0012). */
function outcomeBadge(outcome: TraceOutcome): string {
  const classes = toneClasses(TRACE_OUTCOME_TONE[outcome]);
  return `${classes.bg} ${classes.textBolder} ${classes.ringSubtle}`;
}

function OutcomeSummary({ result }: { result: CompareRunResult | null }): JSX.Element {
  if (!result) {
    return (
      <p className="border-b border-default px-3 py-2 text-xs text-subtle">
        {UI_LABELS.compareSandboxNote.text} Gửi một request trong MiniShop để xem hai trace cạnh
        nhau.
      </p>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-default px-3 py-2 text-xs"
    >
      <span className="text-subtle">
        Action <code className="text-default">{result.action}</code>:
      </span>
      {SIDES.map(({ side }) => {
        const outcome = result[side].response.meta.outcome;
        return (
          <span
            key={side}
            data-testid={`compare-outcome-${side}`}
            className={`rounded-full px-2 py-0.5 font-medium ring-1 ${outcomeBadge(outcome)}`}
          >
            {UI_LABELS[side].text}: {TRACE_OUTCOME_LABELS[outcome]}
          </span>
        );
      })}
    </div>
  );
}

function stepForSide(row: CompareRow | undefined, side: LabMode): TraceStep | null {
  return row ? row[side] : null;
}

function lineFor(step: TraceStep | null, source: LabSourceResponse, side: LabMode): number | null {
  if (!step || step.layer === 'frontend') {
    return null;
  }
  return source[side].steps[step.tag] ?? null;
}

function CompareCodeViewInner({
  source,
  result,
  activeIndex,
  onSelectRow,
}: CompareCodeViewProps): JSX.Element {
  const activeRow = result?.rows[activeIndex];
  const omitsRenderSteps = result !== null && source.frontend_vulnerable != null;

  return (
    // Summary and trace table stay put; only the code grid scrolls to the glowing lines.
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <OutcomeSummary result={result} />
        {omitsRenderSteps && (
          <p className="border-b border-default px-3 py-1.5 text-xs text-subtle">
            Phía Secure không có bước render frontend: MiniShop vẽ kết quả bằng sink của phía
            Vulnerable. Xem khác biệt của sink ở tab Diff.
          </p>
        )}
        {result && (
          <CompareTraceTable
            rows={result.rows}
            activeIndex={activeIndex}
            onSelectRow={onSelectRow}
          />
        )}
      </div>
      <div className="vvwa-ide-scroll grid min-h-0 flex-1 grid-cols-1 overflow-auto @3xl:grid-cols-2 @3xl:divide-x @3xl:divide-default">
        {SIDES.map(({ side, file, headingClass }) => {
          const step = stepForSide(activeRow, side);
          return (
            <section key={side} aria-label={`Mã nguồn ${file}`} className="min-w-0 overflow-x-auto">
              <h3
                className={`px-3 pt-3 text-xs font-semibold uppercase tracking-wide ${headingClass}`}
              >
                backend/{file}
              </h3>
              <CodeSnippetView
                code={source[side].code}
                language="python"
                highlightedLine={lineFor(step, source, side)}
                activeStep={step}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render the Song song backend view: outcome summary, stage-aligned trace table, and
 * vulnerable.py next to secure.py, each glowing the line of its own step in the row.
 */
export const CompareCodeView = memo(CompareCodeViewInner);
