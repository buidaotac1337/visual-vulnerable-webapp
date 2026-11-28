import type { CompareRow, LabMode, TraceStep, TraceStepDraft } from '@/types';

function stepKey(step: TraceStep): string {
  return `${step.layer}:${step.tag}`;
}

/** Row-major (n+1) x (m+1) table of longest-common-subsequence suffix lengths. */
function buildSuffixTable(
  vulnerable: readonly TraceStep[],
  secure: readonly TraceStep[],
): (i: number, j: number) => number {
  const width = secure.length + 1;
  const table = new Array<number>((vulnerable.length + 1) * width).fill(0);
  const cell = (i: number, j: number): number => table[i * width + j] ?? 0;
  for (let i = vulnerable.length - 1; i >= 0; i -= 1) {
    for (let j = secure.length - 1; j >= 0; j -= 1) {
      const v = vulnerable[i];
      const s = secure[j];
      const same = v !== undefined && s !== undefined && stepKey(v) === stepKey(s);
      table[i * width + j] = same
        ? cell(i + 1, j + 1) + 1
        : Math.max(cell(i + 1, j), cell(i, j + 1));
    }
  }
  return cell;
}

function rowOf(vulnerable: TraceStep | null, secure: TraceStep | null): CompareRow {
  const ref = vulnerable ?? secure;
  return {
    layer: ref?.layer ?? 'backend',
    tag: ref?.tag ?? '',
    vulnerable,
    secure,
  };
}

/**
 * Align the vulnerable and secure traces of one Song song run stage by stage.
 *
 * Steps sharing the same layer and `@step` tag land on one row (longest common
 * subsequence); a step only one side runs, such as a check the secure version adds
 * or work the vulnerable version does after the secure one already stopped, gets a
 * row with an empty cell on the other side.
 *
 * @param vulnerable - Merged trace of the vulnerable side.
 * @param secure - Merged trace of the secure side.
 * @returns Ordered rows covering every step of both traces exactly once.
 */
export function alignCompareTraces(
  vulnerable: readonly TraceStep[],
  secure: readonly TraceStep[],
): CompareRow[] {
  const cell = buildSuffixTable(vulnerable, secure);
  const rows: CompareRow[] = [];
  let i = 0;
  let j = 0;
  while (i < vulnerable.length || j < secure.length) {
    const v = vulnerable[i];
    const s = secure[j];
    if (v && s && stepKey(v) === stepKey(s)) {
      rows.push(rowOf(v, s));
      i += 1;
      j += 1;
    } else if (v && (!s || cell(i + 1, j) >= cell(i, j + 1))) {
      rows.push(rowOf(v, null));
      i += 1;
    } else if (s) {
      rows.push(rowOf(null, s));
      j += 1;
    }
  }
  return rows;
}

/**
 * Turn aligned rows into one playback trace, so a single play/step control drives both sides.
 *
 * @param rows - Aligned compare rows.
 * @returns One step per row, numbered from 1, preferring the vulnerable cell's content.
 */
export function buildCompareRowTrace(rows: readonly CompareRow[]): TraceStep[] {
  return rows.map((row, index) => {
    const ref = row.vulnerable ?? row.secure;
    return {
      step: index + 1,
      layer: row.layer,
      tag: row.tag,
      status: ref?.status ?? 'info',
      title: ref?.title ?? '',
      detail: ref?.detail ?? '',
    };
  });
}

/**
 * Map a playback row to the index of the latest step one side has reached at that row.
 *
 * @param rows - Aligned compare rows.
 * @param rowIndex - Active 0-based row index (-1 when idle).
 * @param side - Side whose trace index is wanted.
 * @returns 0-based index into that side's trace, or -1 before its first step.
 */
export function sideIndexAtRow(
  rows: readonly CompareRow[],
  rowIndex: number,
  side: LabMode,
): number {
  let count = 0;
  for (let index = 0; index <= rowIndex && index < rows.length; index += 1) {
    if (rows[index]?.[side]) {
      count += 1;
    }
  }
  return count - 1;
}

/**
 * Map a step index of one side back to the playback row that shows it.
 *
 * @param rows - Aligned compare rows.
 * @param side - Side the index belongs to.
 * @param sideIndex - 0-based index into that side's trace.
 * @returns Row index, or -1 when the side has no such step.
 */
export function rowIndexForSideStep(
  rows: readonly CompareRow[],
  side: LabMode,
  sideIndex: number,
): number {
  let count = -1;
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.[side]) {
      count += 1;
      if (count === sideIndex) {
        return index;
      }
    }
  }
  return -1;
}

/**
 * Re-point frontend step drafts written for one mode at the other mode's endpoint.
 *
 * LabView builds its "send request" steps with the mode it renders in, which is
 * `vulnerable` during a Song song run; the secure side reuses them with the
 * `/api/labs/<id>/vulnerable/` segment swapped for `/api/labs/<id>/secure/`.
 *
 * @param drafts - Frontend steps the LabView supplied.
 * @param labId - Lab identifier used in the endpoint path.
 * @param from - Mode the drafts were written for.
 * @param to - Mode the drafts should describe.
 * @returns New drafts with the endpoint segment replaced in title and detail.
 */
export function retargetStepDrafts(
  drafts: readonly TraceStepDraft[],
  labId: string,
  from: LabMode,
  to: LabMode,
): TraceStepDraft[] {
  const source = `/api/labs/${labId}/${from}/`;
  const target = `/api/labs/${labId}/${to}/`;
  return drafts.map((draft) => ({
    ...draft,
    title: draft.title.replaceAll(source, target),
    detail: draft.detail.replaceAll(source, target),
  }));
}
