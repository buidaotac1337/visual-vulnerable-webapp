import type {
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  TraceLayer,
  TraceStatus,
  TraceStep,
} from './api';

/** Active tab inside the right-hand Code & Trace Inspector panel. */
export type InspectorTab = 'backend' | 'frontend' | 'diff';

/** Desktop (lg+) arrangement of MiniShop Sandbox and Code & Trace Inspector. */
export type WorkspaceLayoutMode = 'split' | 'code-focus' | 'floating';

/** Playback lifecycle state for step-by-step live trace animation. */
export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed';

/** Playback cadence setting for live execution trace animation. */
export type TracePlaybackSpeed = 'manual' | '0.5x' | '1x' | '2x';

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

/** Last non-silent lab action request sent from MiniShop Sandbox (used by FlowPipeline wire tooltips). */
export interface LastExecutionRequest {
  labId: string;
  mode: LabMode;
  actor: string | null;
  action: string;
  body: LabPayload;
}

/** Visual state of one architectural node inside FlowPipeline. */
export type PipelineVisualState = 'idle' | 'active' | 'completed';

/** Derived display model for a single FlowPipeline node. */
export interface PipelineNodeModel {
  layer: TraceLayer;
  label: string;
  narrowLabel: string;
  visualState: PipelineVisualState;
  status: TraceStatus;
  stepCount: number;
  hasSteps: boolean;
  stepIndices: readonly number[];
  latestTitle: string | null;
}

/** Stable identifier for one directional wire lane in FlowPipeline. */
export type PipelineWireKey = 'uiBeFwd' | 'uiBeRev' | 'beDbFwd' | 'beDbRev';

/** Travel direction of a FlowPipeline wire lane. */
export type PipelineWireDirection = 'forward' | 'reverse';

/** Visual lifecycle state of a single directional wire lane. */
export type PipelineLaneState = 'idle' | 'passed' | 'active' | 'blocked' | 'muted';

/** Detail density chosen inside the wire payload hover popover. */
export type PipelineWireDetailMode = 'compact' | 'full';

/** Display model for one directional lane between two architectural layers. */
export interface PipelineLaneModel {
  key: PipelineWireKey;
  direction: PipelineWireDirection;
  state: PipelineLaneState;
  tone: TraceStatus;
  label: string;
  narrowLabel: string;
  gateLabel?: string;
  narrowGateLabel?: string;
}

/** Forward (top) and reverse (bottom) lanes connecting two adjacent nodes. */
export interface PipelineWirePair {
  forward: PipelineLaneModel;
  reverse: PipelineLaneModel;
}

/** Hover payload preview shown when inspecting a FlowPipeline directional wire. */
export interface PipelineWirePayload {
  key: PipelineWireKey;
  stepIndex: number | null;
  status: TraceStatus;
  label: string;
  compact: string;
  full: string;
}

/** Complete derived dual-lane wire and data-journey state for FlowPipeline. */
export interface PipelineTraceModel {
  uiBe: PipelineWirePair;
  beDb: PipelineWirePair;
  blockedBeforeDb: boolean;
  isSelfLoop: boolean;
  activeStep: TraceStep | null;
  prevStep: TraceStep | null;
  hopRoute: string;
  wirePayloads: Record<PipelineWireKey, PipelineWirePayload>;
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
