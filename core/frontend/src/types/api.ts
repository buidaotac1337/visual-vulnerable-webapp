/** Allowed execution mode for MiniShop security labs. */
export type LabMode = 'vulnerable' | 'secure';

/** Architectural layer attached to a live execution trace step. */
export type TraceLayer = 'frontend' | 'backend' | 'database';

/** Semantic security color status for trace steps and pipeline nodes. */
export type TraceStatus = 'info' | 'warning' | 'danger' | 'safe';

/** High-level pedagogical outcome returned by a lab action. */
export type TraceOutcome = 'exploited' | 'blocked' | 'normal' | 'error';

/** One-click pedagogical payload button defined in a lab's meta.json. */
export interface SamplePayload {
  label: string;
  description: string;
  data: Record<string, unknown>;
  /** Persona the sandbox switches to when the chip is clicked (ADR-0005). */
  actor?: string | null;
}

/** Backend assertion graded by POST /api/labs/{id}/verify (layer defaults to 'backend'). */
export interface BackendVerifyTestCase {
  layer?: 'backend';
  name: string;
  action: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
  /** Persona whose session the backend handler receives via ctx (ADR-0005). */
  actor?: string | null;
}

/** Frontend assertion rendered from frontend/vulnerable.tsx in an inert document (ADR-0006). */
export interface FrontendVerifyTestCase {
  layer: 'frontend';
  name: string;
  /** Named export of frontend/vulnerable.tsx to render. */
  component: string;
  props: Record<string, unknown>;
  expect: Record<string, unknown>;
}

/** Single automated assertion defined in meta.json verifyTests. */
export type VerifyTestCase = BackendVerifyTestCase | FrontendVerifyTestCase;

/**
 * Validated lab metadata returned by GET /api/labs.
 * Uses camelCase aliases emitted by FastAPI response_model_by_alias=True.
 */
export interface LabMetadata {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  summary: string;
  safetyPattern: string;
  samplePayloads: SamplePayload[];
  verifyTests: VerifyTestCase[];
  /** Seed usernames offered in the persona switcher; first is the default (ADR-0005). */
  actors?: string[];
}

/** Response envelope returned by GET /api/labs. */
export interface LabListResponse {
  labs: LabMetadata[];
}

/** Single sequential step driving live FlowPipeline and CodeInspector glow. */
export interface TraceStep {
  step: number;
  layer: TraceLayer;
  tag: string;
  status: TraceStatus;
  title: string;
  detail: string;
}

/** Execution context metadata inside POST /api/labs/{id}/{mode}/{action}. */
export interface LabExecutionMeta {
  lab_id: string;
  mode: LabMode;
  outcome: TraceOutcome;
}

/** Unified response envelope from POST /api/labs/{id}/{mode}/{action}. */
export interface LabExecutionResponse {
  ok: boolean;
  data: Record<string, unknown>;
  meta: LabExecutionMeta;
  trace: TraceStep[];
}

/** Cleaned source snippet and @step tag-to-line map from GET /api/labs/{id}/source. */
export interface ParsedSourceFile {
  code: string;
  steps: Record<string, number>;
  line_count: number;
}

/** Response envelope returned by GET /api/labs/{id}/source. */
export interface LabSourceResponse {
  lab_id: string;
  vulnerable: ParsedSourceFile;
  secure: ParsedSourceFile;
  frontend: ParsedSourceFile | null;
  diff: string;
  /** frontend/vulnerable.tsx when the lab has a sink pair (ADR-0006). */
  frontend_vulnerable?: ParsedSourceFile | null;
  /** frontend/secure.tsx when the lab has a sink pair (ADR-0006). */
  frontend_secure?: ParsedSourceFile | null;
  /** Unified diff of the frontend sink pair, or null without a pair. */
  frontend_diff?: string | null;
}

/** Layer a verify test belongs to: graded by FastAPI or in the browser (ADR-0006). */
export type VerifyLayer = 'backend' | 'frontend';

/** Outcome of one automated verification test case (backend API or frontend runner). */
export interface VerifyTestResult {
  name: string;
  /** Backend action name, or the frontend component export name. */
  action: string;
  /** Defaults to 'backend' when absent. */
  layer?: VerifyLayer;
  passed: boolean;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  error: string | null;
}

/** Aggregate verification report returned by POST /api/labs/{id}/verify. */
export interface VerifyLabResponse {
  ok: boolean;
  lab_id: string;
  passed: boolean;
  total: number;
  passed_count: number;
  results: VerifyTestResult[];
}

/** Confirmation response returned by POST /api/system/reset-db. */
export interface ResetDatabaseResponse {
  ok: boolean;
  message: string;
  duration_ms: number;
}
