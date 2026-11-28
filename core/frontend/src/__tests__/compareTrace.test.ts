import { describe, expect, it } from 'vitest';

import {
  alignCompareTraces,
  buildCompareRowTrace,
  retargetStepDrafts,
  rowIndexForSideStep,
  sideIndexAtRow,
} from '@/lib';
import type { TraceLayer, TraceStatus, TraceStep } from '@/types';

function step(
  index: number,
  tag: string,
  status: TraceStatus = 'info',
  layer: TraceLayer = 'backend',
): TraceStep {
  return { step: index, layer, tag, status, title: `${tag} title`, detail: `${tag} detail` };
}

const VULN: TraceStep[] = [
  step(1, 'fe-submit', 'info', 'frontend'),
  step(2, 'engine-session'),
  step(3, 'read-file-name', 'warning'),
  step(4, 'build-path', 'danger'),
  step(5, 'read-file', 'danger', 'database'),
];

const SECURE: TraceStep[] = [
  step(1, 'fe-submit', 'info', 'frontend'),
  step(2, 'engine-session'),
  step(3, 'read-file-name'),
  step(4, 'validate-name', 'safe'),
];

describe('Song song trace alignment (ADR-0010)', () => {
  it('pairs shared layer+tag steps and leaves an empty cell for one-sided steps', () => {
    const rows = alignCompareTraces(VULN, SECURE);

    expect(
      rows.map((row) => [row.tag, row.vulnerable?.step ?? null, row.secure?.step ?? null]),
    ).toEqual([
      ['fe-submit', 1, 1],
      ['engine-session', 2, 2],
      ['read-file-name', 3, 3],
      ['build-path', 4, null],
      ['read-file', 5, null],
      ['validate-name', null, 4],
    ]);
  });

  it('does not pair the same tag on different layers', () => {
    const rows = alignCompareTraces(
      [step(1, 'load', 'info', 'backend')],
      [step(1, 'load', 'info', 'database')],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.secure).toBeNull();
    expect(rows[1]?.vulnerable).toBeNull();
  });

  it('covers every step once even when one side is empty', () => {
    expect(alignCompareTraces([], SECURE).map((row) => row.secure?.step)).toEqual([1, 2, 3, 4]);
    expect(alignCompareTraces(VULN, [])).toHaveLength(VULN.length);
    expect(alignCompareTraces([], [])).toEqual([]);
  });

  it('builds a 1-based playback trace preferring the vulnerable cell', () => {
    const rowTrace = buildCompareRowTrace(alignCompareTraces(VULN, SECURE));
    expect(rowTrace.map((item) => item.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rowTrace[3]).toMatchObject({ tag: 'build-path', status: 'danger' });
    expect(rowTrace[5]).toMatchObject({ tag: 'validate-name', status: 'safe' });
  });

  it('maps rows to side indices and back', () => {
    const rows = alignCompareTraces(VULN, SECURE);
    expect(sideIndexAtRow(rows, -1, 'vulnerable')).toBe(-1);
    expect(sideIndexAtRow(rows, 3, 'vulnerable')).toBe(3);
    // Row 4 (read-file) has no secure step: the secure side stays on its last reached step.
    expect(sideIndexAtRow(rows, 4, 'secure')).toBe(2);
    expect(sideIndexAtRow(rows, 5, 'secure')).toBe(3);

    expect(rowIndexForSideStep(rows, 'secure', 3)).toBe(5);
    expect(rowIndexForSideStep(rows, 'vulnerable', 4)).toBe(4);
    expect(rowIndexForSideStep(rows, 'secure', 9)).toBe(-1);
  });

  it('re-points LabView send steps at the secure endpoint only', () => {
    const [draft] = retargetStepDrafts(
      [
        {
          layer: 'frontend',
          tag: 'fe-submit',
          status: 'info',
          title: 'Gửi form',
          detail: 'POST /api/labs/01-sql-injection/vulnerable/login với username="vulnerable"',
        },
      ],
      '01-sql-injection',
      'vulnerable',
      'secure',
    );
    expect(draft?.detail).toBe(
      'POST /api/labs/01-sql-injection/secure/login với username="vulnerable"',
    );
  });
});
