import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCompareRun } from '@/hooks';
import type { CompareRunDeps } from '@/hooks';
import type { LabExecutionResponse, LabMode, TraceOutcome } from '@/types';

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function labResponse(mode: LabMode, outcome: TraceOutcome): LabExecutionResponse {
  return {
    ok: true,
    data: { side: mode },
    meta: { lab_id: '08-race', mode, outcome },
    trace: [
      {
        step: 1,
        layer: 'backend',
        tag: 'check-limit',
        status: mode === 'secure' ? 'safe' : 'danger',
        title: `${mode} check`,
        detail: `${mode} detail`,
      },
    ],
  };
}

function stubFetch(resetOk = true): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/system/reset-db') {
        if (!resetOk) {
          return { ok: false, status: 500, json: async () => ({ detail: 'reset boom' }) };
        }
        return okJson({ ok: true, message: 'reset', duration_ms: 1 });
      }
      return okJson(
        url.includes('/secure/')
          ? labResponse('secure', 'blocked')
          : labResponse('vulnerable', 'exploited'),
      );
    }),
  );
  return calls;
}

function makeDeps(overrides: Partial<CompareRunDeps> = {}): CompareRunDeps {
  return {
    isCurrent: () => true,
    omitSecureRenderSteps: false,
    refreshSource: vi.fn(async () => undefined),
    setDbResetSeq: vi.fn(),
    trackInFlight: async (task) => task(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

const CALL = { labId: '08-race', actor: 'alice', action: 'apply_coupon', body: { code: 'X' } };
const SEND_STEP = {
  layer: 'frontend' as const,
  tag: 'fe-send-burst',
  status: 'info' as const,
  title: 'Gửi burst',
  detail: 'POST /api/labs/08-race/vulnerable/apply_coupon (3x Promise.all)',
};
const RENDER_STEP = { ...SEND_STEP, tag: 'fe-render-burst', title: 'Vẽ kết quả', detail: 'ok' };

describe('useCompareRun (ADR-0010)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs one handler burst as a batch: Reset → secure ×N → Reset → vulnerable ×N', async () => {
    const calls = stubFetch();
    const deps = makeDeps();
    const { result } = renderHook(() => useCompareRun(deps));

    let responses: (LabExecutionResponse | null)[] = [];
    await act(async () => {
      responses = await Promise.all([
        result.current.enqueueCompareCall({ ...CALL, options: { silent: true } }),
        result.current.enqueueCompareCall({ ...CALL, options: { silent: true } }),
        result.current.enqueueCompareCall({
          ...CALL,
          options: { frontendStepsBefore: [SEND_STEP], frontendStepsAfter: () => [RENDER_STEP] },
        }),
      ]);
    });

    const secureUrl = '/api/labs/08-race/secure/apply_coupon';
    const vulnUrl = '/api/labs/08-race/vulnerable/apply_coupon';
    expect(calls).toEqual([
      '/api/system/reset-db',
      secureUrl,
      secureUrl,
      secureUrl,
      '/api/system/reset-db',
      vulnUrl,
      vulnUrl,
      vulnUrl,
    ]);
    expect(responses.map((resp) => resp?.meta.mode)).toEqual([
      'vulnerable',
      'vulnerable',
      'vulnerable',
    ]);
    expect(deps.setDbResetSeq).toHaveBeenCalledTimes(1);
    expect(deps.onComplete).toHaveBeenCalledTimes(1);

    const run = result.current.compareResult;
    expect(run?.secure.trace[0]?.detail).toBe(
      'POST /api/labs/08-race/secure/apply_coupon (3x Promise.all)',
    );
    expect(run?.secure.trace.map((item) => item.tag)).toEqual([
      'fe-send-burst',
      'check-limit',
      'fe-render-burst',
    ]);
    expect(run?.rows).toHaveLength(3);
    expect(run?.secure.response.meta.outcome).toBe('blocked');
  });

  it('runs a batch of only silent reads on the vulnerable side without resetting', async () => {
    const calls = stubFetch();
    const deps = makeDeps();
    const { result } = renderHook(() => useCompareRun(deps));

    await act(async () => {
      await result.current.enqueueCompareCall({ ...CALL, options: { silent: true } });
    });

    expect(calls).toEqual(['/api/labs/08-race/vulnerable/apply_coupon']);
    expect(deps.onComplete).not.toHaveBeenCalled();
    expect(result.current.compareResult).toBeNull();
  });

  it('drops LabView render steps from the secure side of a lab with a frontend sink pair', async () => {
    stubFetch();
    const deps = makeDeps({ omitSecureRenderSteps: true });
    const { result } = renderHook(() => useCompareRun(deps));

    await act(async () => {
      await result.current.enqueueCompareCall({
        ...CALL,
        options: { frontendStepsBefore: [SEND_STEP], frontendStepsAfter: () => [RENDER_STEP] },
      });
    });

    const run = result.current.compareResult;
    expect(run?.vulnerable.trace.map((item) => item.tag)).toContain('fe-render-burst');
    expect(run?.secure.trace.map((item) => item.tag)).not.toContain('fe-render-burst');
  });

  it('keeps a run that finishes off screen out of the workspace', async () => {
    stubFetch();
    const deps = makeDeps({ isCurrent: () => false });
    const { result } = renderHook(() => useCompareRun(deps));

    let response: LabExecutionResponse | null = null;
    await act(async () => {
      response = await result.current.enqueueCompareCall(CALL);
    });

    expect(response).not.toBeNull();
    expect(deps.onComplete).not.toHaveBeenCalled();
    expect(result.current.compareResult).toBeNull();
  });

  it('resolves callers with null and reports the error when Reset DB fails', async () => {
    const calls = stubFetch(false);
    const deps = makeDeps();
    const { result } = renderHook(() => useCompareRun(deps));

    let response: LabExecutionResponse | null = labResponse('vulnerable', 'normal');
    await act(async () => {
      response = await result.current.enqueueCompareCall(CALL);
    });

    expect(response).toBeNull();
    expect(calls).toEqual(['/api/system/reset-db']);
    expect(deps.onError).toHaveBeenCalledWith('reset boom');
  });
});
