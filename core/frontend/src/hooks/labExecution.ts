import { executeLabAction, mergeExecutionTrace } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabPayload,
  WorkspaceMode,
} from '@/types';

/** Identity of the workspace context a request was issued from (stale-response guard). */
export interface ActiveRequestContext {
  labId: string | null;
  /** Workspace view on screen; single-mode responses only apply while it equals their mode. */
  view: WorkspaceMode;
  actor: string | null;
}

/** One lab action invocation issued by the workspace. */
export interface ExecutionRequest {
  labId: string;
  mode: LabMode;
  actor: string | null;
  action: string;
  body: LabPayload;
}

/**
 * Return the first sample payload of a lab as the initial sandbox form state.
 *
 * @param lab - Selected lab metadata, or null.
 * @returns A copy of the first sample payload data, or an empty object.
 */
export function defaultPayloadForLab(lab: LabMetadata | null): LabPayload {
  const firstSample = lab?.samplePayloads[0];
  return firstSample ? { ...firstSample.data } : {};
}

/**
 * Extract a displayable message from an unknown thrown value.
 *
 * @param error - Value caught from a failed request.
 * @param fallback - Message used when the error carries none.
 * @returns Human-readable error message.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/**
 * Check whether a response still belongs to the lab, mode, and persona on screen.
 *
 * @param ctx - Current workspace context.
 * @param req - Request whose response just arrived.
 * @returns True when the response may update the UI.
 */
export function isSameContext(ctx: ActiveRequestContext, req: ExecutionRequest): boolean {
  return ctx.labId === req.labId && ctx.view === req.mode && ctx.actor === req.actor;
}

/**
 * Execute a lab action, refreshing live source in parallel unless silent.
 *
 * @param req - Lab, mode, persona, action, and payload to send.
 * @param silent - When true, skip the parallel source refresh.
 * @param refreshSource - Callback re-reading lab source files from disk.
 * @returns Lab execution response envelope.
 */
export async function runExecutionRequest(
  req: ExecutionRequest,
  silent: boolean,
  refreshSource: (silent?: boolean) => Promise<void>,
): Promise<LabExecutionResponse> {
  const execPromise = executeLabAction(req.labId, req.mode, req.action, req.body, req.actor);
  if (silent) {
    return execPromise;
  }
  const [execResp] = await Promise.all([execPromise, refreshSource(true)]);
  return execResp;
}

/**
 * Merge optional frontend pre/post steps around the backend trace.
 *
 * @param execResp - Backend execution response.
 * @param options - Optional frontend trace hooks from the LabView.
 * @returns Sequentially numbered combined trace.
 */
export function buildMergedTrace(
  execResp: LabExecutionResponse,
  options?: ExecuteActionOptions,
): ReturnType<typeof mergeExecutionTrace> {
  const before = options?.frontendStepsBefore ?? [];
  const after = options?.frontendStepsAfter ? options.frontendStepsAfter(execResp) : [];
  return mergeExecutionTrace(before, execResp.trace, after);
}
