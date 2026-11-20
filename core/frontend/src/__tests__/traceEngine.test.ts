import { describe, expect, it } from 'vitest';

import {
  computePipelineNodes,
  findFirstStepIndexForLayer,
  mergeExecutionTrace,
  resolveStepTarget,
} from '@/lib';
import type { LabSourceResponse, TraceStep } from '@/types';

const SAMPLE_SOURCE: LabSourceResponse = {
  lab_id: '01-sql-injection',
  vulnerable: {
    code: 'async def login(payload, db):\n    sql = f"SELECT ..."\n    row = await db.fetch_one(sql)',
    steps: { 'build-query': 2, 'exec-query': 3 },
    line_count: 3,
  },
  secure: {
    code: 'async def login(payload, db):\n    sql = "SELECT $1"\n    row = await db.fetch_one(sql, u)',
    steps: { 'build-query': 2, 'exec-query': 3 },
    line_count: 3,
  },
  frontend: {
    code: 'function LabView() {\n  onExecute("login");\n}',
    steps: { 'fe-submit': 2 },
    line_count: 3,
  },
  diff: '@@ -2 +2 @@\n-old\n+new\n',
};

describe('traceEngine', () => {
  it('merges frontend and backend trace steps with sequential 1-based numbering', () => {
    const merged = mergeExecutionTrace(
      [
        {
          layer: 'frontend',
          tag: 'fe-submit',
          status: 'info',
          title: 'Submit login',
          detail: 'POST /login',
        },
      ],
      [
        {
          step: 99,
          layer: 'backend',
          tag: 'build-query',
          status: 'danger',
          title: 'f-string concat',
          detail: 'SELECT ...',
        },
      ],
      [
        {
          layer: 'frontend',
          tag: 'fe-done',
          status: 'warning',
          title: 'Render response',
          detail: 'admin',
        },
      ],
    );

    expect(merged.map((step) => step.step)).toEqual([1, 2, 3]);
    expect(merged[0]?.layer).toBe('frontend');
    expect(merged[1]?.layer).toBe('backend');
    expect(merged[2]?.tag).toBe('fe-done');
  });

  it('computes pipeline states and picks highest severity (danger > warning > safe > info)', () => {
    const trace: TraceStep[] = [
      { step: 1, layer: 'frontend', tag: 'fe-submit', status: 'info', title: 'UI', detail: 'a' },
      { step: 2, layer: 'backend', tag: 's1', status: 'warning', title: 'Warn', detail: 'b' },
      { step: 3, layer: 'backend', tag: 's2', status: 'danger', title: 'SQLi', detail: 'c' },
      { step: 4, layer: 'database', tag: 'db', status: 'safe', title: 'DB', detail: 'd' },
    ];

    const midNodes = computePipelineNodes(trace, 2, true);
    expect(midNodes[0]?.visualState).toBe('completed');
    expect(midNodes[1]?.visualState).toBe('active');
    expect(midNodes[1]?.status).toBe('danger');
    expect(midNodes[2]?.visualState).toBe('idle');

    expect(findFirstStepIndexForLayer(trace, 'database')).toBe(3);
  });

  it('resolves frontend, backend, and unmapped runtime-error targets accurately', () => {
    const feStep: TraceStep = {
      step: 1,
      layer: 'frontend',
      tag: 'fe-submit',
      status: 'info',
      title: 'UI',
      detail: 'd',
    };
    const errStep: TraceStep = {
      step: 2,
      layer: 'backend',
      tag: 'runtime-error',
      status: 'danger',
      title: 'SyntaxError',
      detail: 'bad syntax',
    };

    expect(resolveStepTarget(feStep, SAMPLE_SOURCE, 'vulnerable')).toEqual({
      tab: 'frontend',
      lineNumber: 2,
    });
    expect(resolveStepTarget(errStep, SAMPLE_SOURCE, 'vulnerable')).toEqual({
      tab: 'backend',
      lineNumber: null,
    });
  });
});
