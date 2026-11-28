import type {
  CompareRunResult,
  ExecuteActionOptions,
  HealthResponse,
  InspectorTab,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabPayload,
  LabSourceResponse,
  LastExecutionRequest,
  ModeOutcomes,
  SamplePayload,
  TraceLayer,
  VerifyLabResponse,
  WorkspaceMode,
  WorkspaceNotice,
} from '@/types';

import type { TracePlaybackController } from './useTracePlayback';

/** Complete reactive state and command handlers driving the VVWA workspace. */
export interface LabWorkspaceController {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  isLoadingLabs: boolean;
  selectedLab: LabMetadata | null;
  /** Mode the sandbox LabView renders in (`vulnerable` while viewMode is `compare`). */
  mode: LabMode;
  /** View chosen on the ModeSwitch: one mode, or `compare` (Song song, ADR-0010). */
  viewMode: WorkspaceMode;
  /** Last outcome seen per mode for the selected lab. */
  modeOutcomes: ModeOutcomes;
  /** Latest Song song run of the selected lab, or null. */
  compareResult: CompareRunResult | null;
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
  lastRequest: LastExecutionRequest | null;
  lastResponse: LabExecutionResponse | null;
  verifyResult: VerifyLabResponse | null;
  verifyError: string | null;
  isVerifyModalOpen: boolean;
  notice: WorkspaceNotice | null;
  playback: TracePlaybackController;
  selectLab: (labId: string) => void;
  changeMode: (nextMode: WorkspaceMode) => void;
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
