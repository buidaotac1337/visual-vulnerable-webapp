import { useCallback, useMemo, useRef, useState } from 'react';

import { buildCompareRowTrace, resolveFrontendFile } from '@/lib';
import type {
  ExecuteActionOptions,
  InspectorTab,
  LabExecutionResponse,
  LabMode,
  LabPayload,
  LastExecutionRequest,
  SamplePayload,
  TraceLayer,
  WorkspaceMode,
  WorkspaceNotice,
} from '@/types';

import {
  buildMergedTrace,
  defaultPayloadForLab,
  getErrorMessage,
  isSameContext,
  runExecutionRequest,
} from './labExecution';
import type { ActiveRequestContext, ExecutionRequest } from './labExecution';
import type { LabWorkspaceController } from './labWorkspaceController';
import { useCompareRun } from './useCompareRun';
import { useLabActor } from './useLabActor';
import { useLabCatalog } from './useLabCatalog';
import { useLabMaintenance } from './useLabMaintenance';
import { useLabSourceSync } from './useLabSourceSync';
import { useLabVerify } from './useLabVerify';
import { useModeOutcomes } from './useModeOutcomes';
import { useTracePlayback } from './useTracePlayback';

/**
 * Orchestrate lab selection, mode toggling (preserving input), live source refresh,
 * action execution with concurrency/staleness guards, and maintenance commands.
 *
 * @returns LabWorkspaceController consumed by App and child panels.
 */
export function useLabWorkspace(): LabWorkspaceController {
  const { health, apiError, labs, isLoadingLabs, selectedLabId, setSelectedLabId } =
    useLabCatalog();
  const [viewMode, setViewMode] = useState<WorkspaceMode>('vulnerable');
  const mode: LabMode = viewMode === 'compare' ? 'vulnerable' : viewMode;
  const [activeTab, setActiveTab] = useState<InspectorTab>('backend');
  const [payloadsByLab, setPayloadsByLab] = useState<Record<string, LabPayload>>({});
  const [inputFlashSeq, setInputFlashSeq] = useState<number>(0);
  const [dbResetSeq, setDbResetSeq] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastRequest, setLastRequest] = useState<LastExecutionRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<LabExecutionResponse | null>(null);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);

  const selectedLab = labs.find((item) => item.id === selectedLabId) ?? null;
  const { actors, actor, setActor } = useLabActor(selectedLab);
  const activeCtxRef = useRef<ActiveRequestContext>({
    labId: selectedLabId,
    view: viewMode,
    actor,
  });
  activeCtxRef.current = { labId: selectedLabId, view: viewMode, actor };
  const inFlightRef = useRef<number>(0);
  const { modeOutcomes, recordOutcomes } = useModeOutcomes(selectedLabId);

  const trackInFlight = useCallback(async <T>(task: () => Promise<T>): Promise<T> => {
    inFlightRef.current += 1;
    setIsExecuting(true);
    try {
      return await task();
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      setIsExecuting(inFlightRef.current > 0);
    }
  }, []);

  const playback = useTracePlayback();
  const { clearTrace, jumpToLayer, startTrace } = playback;
  const { source, sourceError, isRefreshingSource, refreshSource } =
    useLabSourceSync(selectedLabId);
  const maintenance = useLabMaintenance({ selectedLabId, setDbResetSeq, setNotice });
  const verify = useLabVerify({ selectedLab, activeCtxRef, refreshSource, setDbResetSeq });
  const { resetVerifyState } = verify;

  const compare = useCompareRun({
    isCurrent: (labId, runActor) => {
      const ctx = activeCtxRef.current;
      return ctx.view === 'compare' && ctx.labId === labId && ctx.actor === runActor;
    },
    omitSecureRenderSteps: source?.frontend_vulnerable != null,
    refreshSource,
    setDbResetSeq,
    trackInFlight,
    onComplete: (result) => {
      const { labId, actor: runActor, action, body } = result;
      setLastRequest({ labId, mode: 'vulnerable', actor: runActor, action, body });
      setLastResponse(result.vulnerable.response);
      startTrace(buildCompareRowTrace(result.rows));
      recordOutcomes(result.labId, {
        vulnerable: result.vulnerable.response.meta.outcome,
        secure: result.secure.response.meta.outcome,
      });
    },
    onError: (message) => setNotice({ tone: 'danger', message }),
  });
  const { clearCompare, enqueueCompareCall } = compare;

  const payload = useMemo<LabPayload>(
    () => (selectedLab ? (payloadsByLab[selectedLab.id] ?? defaultPayloadForLab(selectedLab)) : {}),
    [selectedLab, payloadsByLab],
  );
  const payloadRef = useRef<LabPayload>(payload);
  payloadRef.current = payload;

  /** Drop the last run (request, response, notice, trace, Song song result) from screen. */
  const clearRun = useCallback((): void => {
    setLastRequest(null);
    setLastResponse(null);
    setNotice(null);
    clearTrace();
    clearCompare();
  }, [clearTrace, clearCompare]);

  const selectLab = useCallback(
    (labId: string): void => {
      setSelectedLabId(labId);
      setActiveTab('backend');
      resetVerifyState();
      clearRun();
    },
    [setSelectedLabId, resetVerifyState, clearRun],
  );

  const changeMode = useCallback(
    (nextMode: WorkspaceMode): void => {
      setViewMode(nextMode);
      clearRun();
    },
    [clearRun],
  );

  const changeActor = useCallback(
    (name: string): void => {
      if (name === actor || !actors.includes(name)) {
        return;
      }
      setActor(name);
      clearRun();
    },
    [actor, actors, setActor, clearRun],
  );

  const selectPipelineLayer = useCallback(
    (layer: TraceLayer): void => {
      jumpToLayer(layer);
      const hasFrontend = resolveFrontendFile(source, mode) !== null;
      setActiveTab(layer === 'frontend' && hasFrontend ? 'frontend' : 'backend');
    },
    [jumpToLayer, source, mode],
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
      if (sample.actor) {
        changeActor(sample.actor);
      }
      setInputFlashSeq((seq) => seq + 1);
    },
    [selectedLabId, changeActor],
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
      const body = overridePayload ?? payloadRef.current;
      const silent = options?.silent === true;
      if (!silent) {
        setNotice(null);
      }
      if (viewMode === 'compare') {
        return enqueueCompareCall({ labId: selectedLabId, actor, action, body, options });
      }
      const req: ExecutionRequest = { labId: selectedLabId, mode, actor, action, body };
      return trackInFlight(async () => {
        try {
          const execResp = await runExecutionRequest(req, silent, refreshSource);
          if (!silent && isSameContext(activeCtxRef.current, req)) {
            setLastRequest(req);
            setLastResponse(execResp);
            startTrace(buildMergedTrace(execResp, options));
            recordOutcomes(req.labId, { [req.mode]: execResp.meta.outcome });
          }
          return execResp;
        } catch (error: unknown) {
          if (!silent && isSameContext(activeCtxRef.current, req)) {
            setNotice({ tone: 'danger', message: getErrorMessage(error, 'Lỗi thực thi bài lab.') });
          }
          return null;
        }
      });
    },
    [
      selectedLabId,
      viewMode,
      mode,
      actor,
      refreshSource,
      startTrace,
      trackInFlight,
      enqueueCompareCall,
      recordOutcomes,
    ],
  );

  return {
    health,
    apiError,
    labs,
    isLoadingLabs,
    selectedLab,
    mode,
    viewMode,
    modeOutcomes,
    compareResult: compare.compareResult,
    actors,
    actor,
    activeTab,
    source,
    sourceError,
    isRefreshingSource,
    payload,
    inputFlashSeq,
    dbResetSeq,
    isExecuting,
    isResettingDb: maintenance.isResettingDb,
    isVerifying: verify.isVerifying,
    isDownloading: maintenance.isDownloading,
    lastRequest,
    lastResponse,
    verifyResult: verify.verifyResult,
    verifyError: verify.verifyError,
    isVerifyModalOpen: verify.isVerifyModalOpen,
    notice,
    playback,
    selectLab,
    changeMode,
    changeActor,
    setActiveTab,
    selectPipelineLayer,
    updatePayload,
    applySamplePayload,
    refreshSource,
    executeAction,
    handleResetDb: maintenance.handleResetDb,
    handleVerify: verify.handleVerify,
    closeVerifyModal: verify.closeVerifyModal,
    handleDownloadSnippet: maintenance.handleDownloadSnippet,
  };
}
