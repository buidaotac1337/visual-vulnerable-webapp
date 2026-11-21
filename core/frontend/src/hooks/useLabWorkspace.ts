import { useCallback, useMemo, useRef, useState } from 'react';

import { resolveFrontendFile } from '@/lib';
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

import {
  buildMergedTrace,
  defaultPayloadForLab,
  getErrorMessage,
  isSameContext,
  runExecutionRequest,
} from './labExecution';
import type { ActiveRequestContext, ExecutionRequest } from './labExecution';
import { useLabActor } from './useLabActor';
import { useLabCatalog } from './useLabCatalog';
import { useLabMaintenance } from './useLabMaintenance';
import { useLabSourceSync } from './useLabSourceSync';
import { useLabVerify } from './useLabVerify';
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
  /** Personas declared by the lab and the active one (ADR-0005). */
  actors: readonly string[];
  actor: string | null;
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
  changeActor: (name: string) => void;
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

  const selectedLab = labs.find((item) => item.id === selectedLabId) ?? null;
  const { actors, actor, setActor } = useLabActor(selectedLab);
  const activeCtxRef = useRef<ActiveRequestContext>({ labId: selectedLabId, mode, actor });
  activeCtxRef.current = { labId: selectedLabId, mode, actor };
  const inFlightRef = useRef<number>(0);

  const playback = useTracePlayback();
  const { source, sourceError, isRefreshingSource, refreshSource } =
    useLabSourceSync(selectedLabId);
  const maintenance = useLabMaintenance({ selectedLabId, setDbResetSeq, setNotice });
  const verify = useLabVerify({ selectedLab, activeCtxRef, refreshSource, setDbResetSeq });

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
      verify.resetVerifyState();
      playback.clearTrace();
    },
    [setSelectedLabId, verify, playback],
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

  const changeActor = useCallback(
    (name: string): void => {
      if (name === actor || !actors.includes(name)) {
        return;
      }
      setActor(name);
      setLastResponse(null);
      setNotice(null);
      playback.clearTrace();
    },
    [actor, actors, setActor, playback],
  );

  const selectPipelineLayer = useCallback(
    (layer: TraceLayer): void => {
      playback.jumpToLayer(layer);
      const hasFrontend = resolveFrontendFile(source, mode) !== null;
      setActiveTab(layer === 'frontend' && hasFrontend ? 'frontend' : 'backend');
    },
    [playback, source, mode],
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
      const req: ExecutionRequest = {
        labId: selectedLabId,
        mode,
        actor,
        action,
        body: overridePayload ?? payload,
      };
      const silent = options?.silent === true;
      inFlightRef.current += 1;
      setIsExecuting(true);
      if (!silent) {
        setNotice(null);
      }
      try {
        const execResp = await runExecutionRequest(req, silent, refreshSource);
        if (!silent && isSameContext(activeCtxRef.current, req)) {
          setLastResponse(execResp);
          playback.startTrace(buildMergedTrace(execResp, options));
        }
        return execResp;
      } catch (error: unknown) {
        if (!silent && isSameContext(activeCtxRef.current, req)) {
          setNotice({ tone: 'danger', message: getErrorMessage(error, 'Lỗi thực thi bài lab.') });
        }
        return null;
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        setIsExecuting(inFlightRef.current > 0);
      }
    },
    [selectedLabId, payload, mode, actor, refreshSource, playback],
  );

  return {
    health,
    apiError,
    labs,
    isLoadingLabs,
    selectedLab,
    mode,
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
