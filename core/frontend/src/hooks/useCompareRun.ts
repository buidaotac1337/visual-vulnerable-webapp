import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { alignCompareTraces, executeLabAction, resetDatabase, retargetStepDrafts } from '@/lib';
import type {
  CompareRunResult,
  CompareSideResult,
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMode,
  LabPayload,
} from '@/types';

import { buildMergedTrace, getErrorMessage } from './labExecution';

/** One LabView `onExecute` call issued while the workspace is in Song song mode. */
export interface CompareCall {
  labId: string;
  actor: string | null;
  action: string;
  body: LabPayload;
  options?: ExecuteActionOptions;
}

interface PendingCall extends CompareCall {
  resolve: (response: LabExecutionResponse | null) => void;
}

/** Workspace callbacks and flags a Song song run needs. */
export interface CompareRunDeps {
  /** True while the lab and persona of a run are still on screen in Song song mode. */
  isCurrent: (labId: string, actor: string | null) => boolean;
  /** Skip LabView render steps on the secure side (they render the mode's sink, ADR-0010). */
  omitSecureRenderSteps: boolean;
  refreshSource: (silent?: boolean) => Promise<void>;
  setDbResetSeq: Dispatch<SetStateAction<number>>;
  trackInFlight: (task: () => Promise<void>) => Promise<void>;
  onComplete: (result: CompareRunResult) => void;
  onError: (message: string) => void;
}

/** Song song run state and the call entry point used by the workspace. */
export interface CompareRunController {
  compareResult: CompareRunResult | null;
  clearCompare: () => void;
  enqueueCompareCall: (call: CompareCall) => Promise<LabExecutionResponse | null>;
}

function lastTraceCall(batch: readonly PendingCall[]): PendingCall | undefined {
  return [...batch].reverse().find((call) => call.options?.silent !== true);
}

function runSide(batch: readonly PendingCall[], mode: LabMode): Promise<LabExecutionResponse[]> {
  return Promise.all(
    batch.map((call) => executeLabAction(call.labId, mode, call.action, call.body, call.actor)),
  );
}

function secureSideOptions(call: CompareCall, omitRenderSteps: boolean): ExecuteActionOptions {
  const before = retargetStepDrafts(
    call.options?.frontendStepsBefore ?? [],
    call.labId,
    'vulnerable',
    'secure',
  );
  const after = call.options?.frontendStepsAfter;
  return omitRenderSteps || !after
    ? { frontendStepsBefore: before }
    : { frontendStepsBefore: before, frontendStepsAfter: after };
}

function buildResult(
  call: CompareCall,
  responses: Record<LabMode, LabExecutionResponse>,
  omitRenderSteps: boolean,
): CompareRunResult {
  const vulnerable: CompareSideResult = {
    response: responses.vulnerable,
    trace: buildMergedTrace(responses.vulnerable, call.options),
  };
  const secure: CompareSideResult = {
    response: responses.secure,
    trace: buildMergedTrace(responses.secure, secureSideOptions(call, omitRenderSteps)),
  };
  return {
    labId: call.labId,
    actor: call.actor,
    action: call.action,
    body: call.body,
    vulnerable,
    secure,
    rows: alignCompareTraces(vulnerable.trace, secure.trace),
  };
}

async function runSilentReads(batch: readonly PendingCall[]): Promise<void> {
  await Promise.all(
    batch.map(async (call) => {
      try {
        call.resolve(
          await executeLabAction(call.labId, 'vulnerable', call.action, call.body, call.actor),
        );
      } catch {
        call.resolve(null);
      }
    }),
  );
}

/**
 * Run LabView requests in Song song mode: Reset DB → secure → Reset DB → vulnerable.
 *
 * Calls a LabView fires in one event handler (e.g. the Lab 08 burst) are buffered for
 * one macrotask and run as one batch, concurrently on each side, so both sides see the
 * same request pattern from the same seed state. A batch of only silent reads runs on
 * the vulnerable side alone. Batches are serialized, so reloads triggered by the run
 * read the final (vulnerable) database state. Each caller receives its vulnerable
 * response, because the sandbox keeps rendering the vulnerable side (ADR-0010).
 *
 * @param deps - Workspace callbacks and flags.
 * @returns CompareRunController with the latest run result and the enqueue entry point.
 */
export function useCompareRun(deps: CompareRunDeps): CompareRunController {
  const depsRef = useRef<CompareRunDeps>(deps);
  depsRef.current = deps;
  const [compareResult, setCompareResult] = useState<CompareRunResult | null>(null);
  const bufferRef = useRef<PendingCall[]>([]);
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const runCompare = useCallback(
    async (batch: readonly PendingCall[], call: PendingCall): Promise<void> => {
      try {
        await resetDatabase();
        depsRef.current.setDbResetSeq((seq) => seq + 1);
        const secure = await runSide(batch, 'secure');
        await resetDatabase();
        const [vulnerable] = await Promise.all([
          runSide(batch, 'vulnerable'),
          depsRef.current.refreshSource(true),
        ]);
        const index = batch.indexOf(call);
        const vulnResp = vulnerable[index];
        const secureResp = secure[index];
        const current = depsRef.current;
        if (vulnResp && secureResp && current.isCurrent(call.labId, call.actor)) {
          const responses = { vulnerable: vulnResp, secure: secureResp };
          const result = buildResult(call, responses, current.omitSecureRenderSteps);
          setCompareResult(result);
          current.onComplete(result);
        }
        batch.forEach((item, itemIndex) => item.resolve(vulnerable[itemIndex] ?? null));
      } catch (error: unknown) {
        batch.forEach((item) => item.resolve(null));
        if (depsRef.current.isCurrent(call.labId, call.actor)) {
          depsRef.current.onError(getErrorMessage(error, 'Không chạy được lượt Song song.'));
        }
      }
    },
    [],
  );

  const flush = useCallback((): void => {
    timerRef.current = null;
    const batch = bufferRef.current;
    bufferRef.current = [];
    if (batch.length === 0) {
      return;
    }
    const previous = chainRef.current;
    chainRef.current = depsRef.current.trackInFlight(async () => {
      await previous;
      const call = lastTraceCall(batch);
      await (call ? runCompare(batch, call) : runSilentReads(batch));
    });
  }, [runCompare]);

  const enqueueCompareCall = useCallback(
    (call: CompareCall): Promise<LabExecutionResponse | null> =>
      new Promise((resolve) => {
        bufferRef.current.push({ ...call, resolve });
        if (timerRef.current === null) {
          timerRef.current = window.setTimeout(flush, 0);
        }
      }),
    [flush],
  );

  const clearCompare = useCallback((): void => setCompareResult(null), []);

  return { compareResult, clearCompare, enqueueCompareCall };
}
