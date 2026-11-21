import type { LabExecutionResponse, LabMetadata, LabMode, TraceLayer, TraceStatus } from './api';

/** Active tab inside the right-hand Code & Trace Inspector panel. */
export type InspectorTab = 'backend' | 'frontend' | 'diff';

/** Playback lifecycle state for step-by-step live trace animation. */
export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed';

/** JSON object representing user-editable inputs inside a MiniShop sandbox form. */
export type LabPayload = Record<string, unknown>;

/** Unnumbered trace step draft emitted by frontend LabView components. */
export interface TraceStepDraft {
  layer: TraceLayer;
  tag: string;
  status: TraceStatus;
  title: string;
  detail: string;
}

/** Optional frontend trace hooks and execution flags supplied when invoking a lab action. */
export interface ExecuteActionOptions {
  /** When true, skip source refresh, trace playback, and lastResponse overwrite (for initial reads). */
  silent?: boolean;
  frontendStepsBefore?: readonly TraceStepDraft[];
  frontendStepsAfter?: (response: LabExecutionResponse) => readonly TraceStepDraft[];
}

/** Props contract implemented by every dynamic labs/<id>/frontend/LabView.tsx plugin. */
export interface LabViewProps {
  lab: LabMetadata;
  mode: LabMode;
  /** Logged-in persona sent as the X-VVWA-Actor session header (display only). */
  actor: string | null;
  payload: LabPayload;
  onPayloadChange: (next: LabPayload) => void;
  inputFlashSeq: number;
  dbResetSeq: number;
  isExecuting: boolean;
  lastResponse: LabExecutionResponse | null;
  onExecute: (
    action: string,
    overridePayload?: LabPayload,
    options?: ExecuteActionOptions,
  ) => Promise<LabExecutionResponse | null>;
}

/** Visual state of one architectural node inside FlowPipeline. */
export type PipelineVisualState = 'idle' | 'active' | 'completed';

/** Derived display model for a single FlowPipeline node. */
export interface PipelineNodeModel {
  layer: TraceLayer;
  label: string;
  visualState: PipelineVisualState;
  status: TraceStatus;
  stepCount: number;
  hasSteps: boolean;
}

/** Which frontend file the Frontend tab shows: the sandbox LabView or the mode's sink file. */
export type FrontendFileKind = 'labview' | 'sink';

/** Resolved inspector destination for an active trace step. */
export interface StepHighlightTarget {
  tab: 'backend' | 'frontend';
  lineNumber: number | null;
  /** For frontend steps: the file holding the tag (defaults to the Frontend tab's default file). */
  frontendFile?: FrontendFileKind;
}

/** Semantic row type parsed from a unified diff string. */
export type DiffRowKind = 'hunk' | 'context' | 'add' | 'remove';

/** Single parsed row rendered inside UnifiedDiffView. */
export interface DiffRow {
  kind: DiffRowKind;
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

/** Minimal syntax token rendered safely via React spans (never innerHTML). */
export interface CodeToken {
  content: string;
  color?: string;
}

/** Supported syntax highlighting languages for CodeSnippetView. */
export type HighlightLanguage = 'python' | 'tsx' | 'sql';

/** Brief status banner notification displayed in the workspace chrome. */
export interface WorkspaceNotice {
  tone: 'info' | 'safe' | 'danger';
  message: string;
}
