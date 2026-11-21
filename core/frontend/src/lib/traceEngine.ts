import type {
  LabMode,
  LabSourceResponse,
  PipelineNodeModel,
  PipelineVisualState,
  StepHighlightTarget,
  TraceLayer,
  TraceStatus,
  TraceStep,
  TraceStepDraft,
} from '@/types';

import { getFrontendSinkFile, resolveFrontendFile } from './sourceFiles';

const STATUS_SEVERITY: Record<TraceStatus, number> = {
  info: 1,
  safe: 2,
  warning: 3,
  danger: 4,
};

const PIPELINE_LAYERS: readonly { layer: TraceLayer; label: string }[] = [
  { layer: 'frontend', label: '1. MiniShop UI' },
  { layer: 'backend', label: '2. FastAPI' },
  { layer: 'database', label: '3. PostgreSQL' },
];

function pickHighestSeverity(statuses: readonly TraceStatus[]): TraceStatus {
  let best: TraceStatus = 'info';
  for (const status of statuses) {
    if (STATUS_SEVERITY[status] > STATUS_SEVERITY[best]) {
      best = status;
    }
  }
  return best;
}

/**
 * Combine optional frontend pre/post trace drafts with backend trace steps,
 * normalizing sequential 1-based step numbering.
 *
 * @param before - Frontend steps emitted before sending the HTTP request.
 * @param backendSteps - Steps returned by FastAPI in LabExecutionResponse.trace.
 * @param after - Frontend steps emitted after receiving the HTTP response.
 * @returns Ordered, sequentially numbered TraceStep array.
 */
export function mergeExecutionTrace(
  before: readonly TraceStepDraft[],
  backendSteps: readonly TraceStep[],
  after: readonly TraceStepDraft[],
): TraceStep[] {
  const combined: TraceStepDraft[] = [...before, ...backendSteps, ...after];
  return combined.map((item, index) => ({
    step: index + 1,
    layer: item.layer,
    tag: item.tag,
    status: item.status,
    title: item.title,
    detail: item.detail,
  }));
}

function resolveNodeVisualState(
  layerIndices: readonly number[],
  activeIndex: number,
  isPlaying: boolean,
): PipelineVisualState {
  if (layerIndices.length === 0 || activeIndex < 0) {
    return 'idle';
  }
  const firstIdx = layerIndices[0];
  if (firstIdx === undefined || firstIdx > activeIndex) {
    return 'idle';
  }
  if (layerIndices.includes(activeIndex) && isPlaying) {
    return 'active';
  }
  return 'completed';
}

/**
 * Derive visual state and highest semantic severity for each FlowPipeline node.
 *
 * @param trace - Full execution trace array.
 * @param activeIndex - 0-based index of the currently highlighted trace step (-1 if idle).
 * @param isPlaying - Whether auto-play animation is currently running.
 * @returns Ordered models for Frontend, Backend, and Database pipeline nodes.
 */
export function computePipelineNodes(
  trace: readonly TraceStep[],
  activeIndex: number,
  isPlaying: boolean,
): PipelineNodeModel[] {
  return PIPELINE_LAYERS.map(({ layer, label }) => {
    const indices: number[] = [];
    const seenStatuses: TraceStatus[] = [];

    trace.forEach((step, idx) => {
      if (step.layer === layer) {
        indices.push(idx);
        if (idx <= activeIndex) {
          seenStatuses.push(step.status);
        }
      }
    });

    return {
      layer,
      label,
      visualState: resolveNodeVisualState(indices, activeIndex, isPlaying),
      status: pickHighestSeverity(seenStatuses),
      stepCount: indices.length,
      hasSteps: indices.length > 0,
    };
  });
}

/**
 * Find the first 0-based trace index belonging to the given architectural layer.
 *
 * @param trace - Full execution trace array.
 * @param layer - Target layer clicked in FlowPipeline.
 * @returns Matching 0-based index, or -1 if no step exists for that layer.
 */
export function findFirstStepIndexForLayer(trace: readonly TraceStep[], layer: TraceLayer): number {
  return trace.findIndex((step) => step.layer === layer);
}

function resolveFrontendStepTarget(
  tag: string,
  source: LabSourceResponse,
  mode: LabMode,
): StepHighlightTarget | null {
  const sinkLine = getFrontendSinkFile(source, mode)?.steps[tag];
  if (sinkLine !== undefined) {
    return { tab: 'frontend', lineNumber: sinkLine, frontendFile: 'sink' };
  }
  const labViewLine = source.frontend?.steps[tag];
  if (labViewLine !== undefined) {
    return { tab: 'frontend', lineNumber: labViewLine, frontendFile: 'labview' };
  }
  const fallback = resolveFrontendFile(source, mode);
  return fallback ? { tab: 'frontend', lineNumber: null, frontendFile: fallback.kind } : null;
}

/**
 * Resolve which CodeInspector tab and 1-based line number correspond to a trace step.
 * Frontend steps look in the mode's sink file first, then LabView.tsx (ADR-0006).
 *
 * @param step - Active trace step, or null when idle.
 * @param source - Live LabSourceResponse loaded from FastAPI.
 * @param mode - Active lab execution mode ('vulnerable' or 'secure').
 * @returns Resolved tab and lineNumber (or null when tag is unmapped, e.g. runtime-error).
 */
export function resolveStepTarget(
  step: TraceStep | null,
  source: LabSourceResponse | null,
  mode: LabMode,
): StepHighlightTarget | null {
  if (!step || !source) {
    return null;
  }
  if (step.layer === 'frontend') {
    const frontendTarget = resolveFrontendStepTarget(step.tag, source, mode);
    if (frontendTarget) {
      return frontendTarget;
    }
  }
  const backendFile = mode === 'vulnerable' ? source.vulnerable : source.secure;
  return {
    tab: 'backend',
    lineNumber: backendFile.steps[step.tag] ?? null,
  };
}
