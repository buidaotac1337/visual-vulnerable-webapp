import { useCallback, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  combineVerifyReports,
  failFrontendVerifyTests,
  isBackendVerifyTest,
  isFrontendVerifyTest,
  loadFrontendSinkModule,
  runFrontendVerifyTests,
  verifyLab,
} from '@/lib';
import type { SinkModule } from '@/lib';
import type { LabMetadata, VerifyLabResponse, VerifyTestResult } from '@/types';

import { getErrorMessage } from './labExecution';

/** Test My Fix state: backend tests via FastAPI plus frontend tests in the browser (ADR-0006). */
export interface LabVerifyController {
  isVerifying: boolean;
  verifyResult: VerifyLabResponse | null;
  verifyError: string | null;
  isVerifyModalOpen: boolean;
  handleVerify: () => Promise<void>;
  closeVerifyModal: () => void;
  resetVerifyState: () => void;
}

interface VerifyHookDeps {
  selectedLab: LabMetadata | null;
  activeCtxRef: MutableRefObject<{ labId: string | null }>;
  refreshSource: () => Promise<void>;
  setDbResetSeq: Dispatch<SetStateAction<number>>;
  /** Injectable for tests; defaults to the Vite-discovered frontend/vulnerable.tsx. */
  loadSink?: (labId: string) => Promise<SinkModule | null>;
}

interface BackendOutcome {
  report: VerifyLabResponse | null;
  error: string | null;
}

async function runBackendTests(lab: LabMetadata): Promise<BackendOutcome> {
  if (!lab.verifyTests.some(isBackendVerifyTest)) {
    return { report: null, error: null };
  }
  try {
    return { report: await verifyLab(lab.id, true), error: null };
  } catch (error: unknown) {
    return { report: null, error: getErrorMessage(error, 'Không thể chạy Test My Fix (backend).') };
  }
}

async function runFrontendTests(
  lab: LabMetadata,
  loadSink: (labId: string) => Promise<SinkModule | null>,
): Promise<VerifyTestResult[]> {
  const tests = lab.verifyTests.filter(isFrontendVerifyTest);
  if (tests.length === 0) {
    return [];
  }
  try {
    return await runFrontendVerifyTests(tests, await loadSink(lab.id));
  } catch (error: unknown) {
    return failFrontendVerifyTests(tests, getErrorMessage(error, 'Không nạp được vulnerable.tsx.'));
  }
}

/**
 * Run Test My Fix: backend verifyTests through POST /verify (with DB reset) and frontend
 * verifyTests in an inert document, in parallel, then merge them into one report.
 *
 * @param deps - Selected lab, staleness ref, source refresh, and DB reset notifier.
 * @returns LabVerifyController for VerifyModal and TopControlBar.
 */
export function useLabVerify({
  selectedLab,
  activeCtxRef,
  refreshSource,
  setDbResetSeq,
  loadSink = loadFrontendSinkModule,
}: VerifyHookDeps): LabVerifyController {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<VerifyLabResponse | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  // Each run (and each reset) takes a new sequence number; only the latest run may update state.
  const runSeqRef = useRef<number>(0);

  const handleVerify = useCallback(async (): Promise<void> => {
    if (!selectedLab) {
      return;
    }
    const lab = selectedLab;
    runSeqRef.current += 1;
    const runSeq = runSeqRef.current;
    setIsVerifyModalOpen(true);
    setIsVerifying(true);
    setVerifyError(null);
    const [backend, frontend] = await Promise.all([
      runBackendTests(lab),
      runFrontendTests(lab, loadSink),
      refreshSource(),
    ]);
    if (backend.report) {
      setDbResetSeq((seq) => seq + 1);
    }
    if (runSeq !== runSeqRef.current || activeCtxRef.current.labId !== lab.id) {
      return;
    }
    setIsVerifying(false);
    // Only a backend failure with nothing else to show collapses to the plain error view;
    // a lab without any verifyTests still gets an (empty, failing) report instead of a blank modal.
    const errorOnly = backend.error !== null && frontend.length === 0;
    setVerifyResult(
      errorOnly
        ? null
        : combineVerifyReports(lab.id, backend.report, frontend, backend.error !== null),
    );
    setVerifyError(backend.error);
  }, [selectedLab, loadSink, refreshSource, setDbResetSeq, activeCtxRef]);

  const closeVerifyModal = useCallback((): void => {
    setIsVerifyModalOpen(false);
  }, []);

  const resetVerifyState = useCallback((): void => {
    runSeqRef.current += 1;
    setIsVerifying(false);
    setVerifyResult(null);
    setVerifyError(null);
    setIsVerifyModalOpen(false);
  }, []);

  return {
    isVerifying,
    verifyResult,
    verifyError,
    isVerifyModalOpen,
    handleVerify,
    closeVerifyModal,
    resetVerifyState,
  };
}
