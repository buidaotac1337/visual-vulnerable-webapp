import { useCallback, useMemo, useRef, useState } from 'react';

import { executeLabAction, mergeExecutionTrace } from '@/lib';
import type {
  ExecuteActionOptions,
  HealthResponse,
  InspectorTab,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabPayload,
  LabSourceResponse,
  SamplePayload,
  TraceLayer,
  VerifyLabResponse,
  WorkspaceNotice,
} from '@/types';

import { useLabCatalog } from './useLabCatalog';
import { useLabMaintenance } from './useLabMaintenance';
import { useLabSourceSync } from './useLabSourceSync';
import { useTracePlayback } from './useTracePlayback';
import type { TracePlaybackController } from './useTracePlayback';

/** Complete reactive state and command handlers driving the VVWA workspace. */
export interface LabWorkspaceController {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  isLoadingLabs: boolean;
  selectedLab: LabMetadata | null;
  mode: LabMode;
  activeTab: InspectorTab;
  source: LabSourceResponse | null;
  sourceError: string | null;
  isRefreshingSource: boolean;
  payload: LabPayload;
  inputFlashSeq: number;
  dbResetSeq: number;
  isExecuting: boolean;
  isResettingDb: boolean;
  isVerifying: boolean;
  isDownloading: boolean;
  lastResponse: LabExecutionResponse | null;
  verifyResult: VerifyLabResponse | null;
  verifyError: string | null;
  isVerifyModalOpen: boolean;
  notice: WorkspaceNotice | null;
  playback: TracePlaybackController;
  selectLab: (labId: string) => void;
  changeMode: (nextMode: LabMode) => void;
  setActiveTab: (tab: InspectorTab) => void;
  selectPipelineLayer: (layer: TraceLayer) => void;
  updatePayload: (next: LabPayload) => void;
  applySamplePayload: (sample: SamplePayload) => void;
  refreshSource: () => Promise<void>;
  executeAction: (
    action: string,
    overridePayload?: LabPayload,
    options?: ExecuteActionOptions,
  ) => Promise<LabExecutionResponse | null>;
  handleResetDb: () => Promise<void>;
  handleVerify: () => Promise<void>;
  closeVerifyModal: () => void;
  handleDownloadSnippet: () => Promise<void>;
}

function defaultPayloadForLab(lab: LabMetadata | null): LabPayload {
  const firstSample = lab?.samplePayloads[0];
  return firstSample ? { ...firstSample.data } : {};
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

function isSameContext(
  ctx: { labId: string | null; mode: LabMode },
  labId: string,
  mode: LabMode,
): boolean {
  return ctx.labId === labId && ctx.mode === mode;
}

async function runExecutionRequest(
  labId: string,
  mode: LabMode,
  action: string,
  body: LabPayload,
  silent: boolean,
  refreshSource: () => Promise<void>,
): Promise<LabExecutionResponse> {
  const execPromise = executeLabAction(labId, mode, action, body);
  if (silent) {
    return execPromise;
  }
  const [execResp] = await Promise.all([execPromise, refreshSource()]);
  return execResp;
}

function buildMergedTrace(
  execResp: LabExecutionResponse,
  options?: ExecuteActionOptions,
): ReturnType<typeof mergeExecutionTrace> {
  const before = options?.frontendStepsBefore ?? [];
  const after = options?.frontendStepsAfter ? options.frontendStepsAfter(execResp) : [];
  return mergeExecutionTrace(before, execResp.trace, after);
}

/**
 * Orchestrate lab selection, mode toggling (preserving input), live source refresh,
 * action execution with concurrency/staleness guards, and maintenance commands.
 *
 * @returns LabWorkspaceController consumed by App and child panels.
 */
export function useLabWorkspace(): LabWorkspaceController {
  const { health, apiError, labs, isLoadingLabs, selectedLabId, setSelectedLabId } =
    useLabCatalog();
  const [mode, setMode] = useState<LabMode>('vulnerable');
  const [activeTab, setActiveTab] = useState<InspectorTab>('backend');
  const [payloadsByLab, setPayloadsByLab] = useState<Record<string, LabPayload>>({});
  const [inputFlashSeq, setInputFlashSeq] = useState<number>(0);
  const [dbResetSeq, setDbResetSeq] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<LabExecutionResponse | null>(null);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);

  const activeCtxRef = useRef<{ labId: string | null; mode: LabMode }>({
    labId: selectedLabId,
    mode,
  });
  activeCtxRef.current = { labId: selectedLabId, mode };
  const inFlightRef = useRef<number>(0);

  const playback = useTracePlayback();
  const { source, sourceError, isRefreshingSource, refreshSource } =
    useLabSourceSync(selectedLabId);
  const maintenance = useLabMaintenance({
    selectedLabId,
    activeCtxRef,
    refreshSource,
    setDbResetSeq,
    setNotice,
  });

  const selectedLab = labs.find((item) => item.id === selectedLabId) ?? null;
  const payload = useMemo<LabPayload>(
    () => (selectedLab ? (payloadsByLab[selectedLab.id] ?? defaultPayloadForLab(selectedLab)) : {}),
    [selectedLab, payloadsByLab],
  );

  const selectLab = useCallback(
    (labId: string): void => {
      setSelectedLabId(labId);
      setActiveTab('backend');
      setLastResponse(null);
      setNotice(null);
      maintenance.resetVerifyState();
      playback.clearTrace();
    },
    [setSelectedLabId, maintenance, playback],
  );

  const changeMode = useCallback(
    (nextMode: LabMode): void => {
      setMode(nextMode);
      setLastResponse(null);
      setNotice(null);
      playback.clearTrace();
    },
    [playback],
  );

  const selectPipelineLayer = useCallback(
    (layer: TraceLayer): void => {
      playback.jumpToLayer(layer);
      setActiveTab(layer === 'frontend' && source?.frontend ? 'frontend' : 'backend');
    },
    [playback, source?.frontend],
  );

  const updatePayload = useCallback(
    (next: LabPayload): void => {
      if (selectedLabId) {
        setPayloadsByLab((prev) => ({ ...prev, [selectedLabId]: next }));
      }
    },
    [selectedLabId],
  );

  const applySamplePayload = useCallback(
    (sample: SamplePayload): void => {
      if (!selectedLabId) {
        return;
      }
      setPayloadsByLab((prev) => ({ ...prev, [selectedLabId]: { ...sample.data } }));
      setInputFlashSeq((seq) => seq + 1);
    },
    [selectedLabId],
  );

  const executeAction = useCallback(
    async (
      action: string,
      overridePayload?: LabPayload,
      options?: ExecuteActionOptions,
    ): Promise<LabExecutionResponse | null> => {
      if (!selectedLabId) {
        return null;
      }
      const reqLabId = selectedLabId;
      const reqMode = mode;
      const silent = options?.silent === true;
      inFlightRef.current += 1;
      setIsExecuting(true);
      if (!silent) {
        setNotice(null);
      }
      try {
        const execResp = await runExecutionRequest(
          reqLabId,
          reqMode,
          action,
          overridePayload ?? payload,
          silent,
          refreshSource,
        );
        if (!silent && isSameContext(activeCtxRef.current, reqLabId, reqMode)) {
          setLastResponse(execResp);
          playback.startTrace(buildMergedTrace(execResp, options));
        }
        return execResp;
      } catch (error: unknown) {
        if (!silent && isSameContext(activeCtxRef.current, reqLabId, reqMode)) {
          setNotice({ tone: 'danger', message: getErrorMessage(error, 'Lỗi thực thi bài lab.') });
        }
        return null;
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        setIsExecuting(inFlightRef.current > 0);
      }
    },
    [selectedLabId, payload, mode, refreshSource, playback],
  );

  return {
    health,
    apiError,
    labs,
    isLoadingLabs,
    selectedLab,
    mode,
    activeTab,
    source,
    sourceError,
    isRefreshingSource,
    payload,
    inputFlashSeq,
    dbResetSeq,
    isExecuting,
    isResettingDb: maintenance.isResettingDb,
    isVerifying: maintenance.isVerifying,
    isDownloading: maintenance.isDownloading,
    lastResponse,
    verifyResult: maintenance.verifyResult,
    verifyError: maintenance.verifyError,
    isVerifyModalOpen: maintenance.isVerifyModalOpen,
    notice,
    playback,
    selectLab,
    changeMode,
    setActiveTab,
    selectPipelineLayer,
    updatePayload,
    applySamplePayload,
    refreshSource,
    executeAction,
    handleResetDb: maintenance.handleResetDb,
    handleVerify: maintenance.handleVerify,
    closeVerifyModal: maintenance.closeVerifyModal,
    handleDownloadSnippet: maintenance.handleDownloadSnippet,
  };
}
