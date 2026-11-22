import type {
  LabExecutionResponse,
  LastExecutionRequest,
  PipelineLaneModel,
  PipelineTraceModel,
  PipelineWirePair,
  TraceLayer,
  TraceStep,
} from '@/types';

import { buildWirePayloads } from './pipelineWirePayloads';

const LAYER_ORDER: Record<TraceLayer, number> = {
  frontend: 0,
  backend: 1,
  database: 2,
};

const LAYER_SHORT: Record<TraceLayer, string> = {
  frontend: 'UI',
  backend: 'FastAPI',
  database: 'PostgreSQL',
};

interface PassedFlags {
  uiBeFwd: boolean;
  uiBeRev: boolean;
  beDbFwd: boolean;
  beDbRev: boolean;
}

function markHopPassed(passed: PassedFlags, fromOrder: number, toOrder: number): void {
  if (fromOrder < toOrder) {
    if (fromOrder === 0) passed.uiBeFwd = true;
    if (toOrder === 2) passed.beDbFwd = true;
    return;
  }
  if (fromOrder > toOrder) {
    if (fromOrder === 2) passed.beDbRev = true;
    if (toOrder === 0) passed.uiBeRev = true;
  }
}

function scanPassedLanes(trace: readonly TraceStep[], activeIndex: number): PassedFlags {
  const passed: PassedFlags = { uiBeFwd: false, uiBeRev: false, beDbFwd: false, beDbRev: false };
  const limit = Math.min(activeIndex, trace.length - 1);
  for (let i = 1; i <= limit; i += 1) {
    const prev = trace[i - 1];
    const curr = trace[i];
    if (prev && curr) {
      markHopPassed(passed, LAYER_ORDER[prev.layer], LAYER_ORDER[curr.layer]);
    }
  }
  return passed;
}

function makeLane(
  base: Pick<PipelineLaneModel, 'key' | 'direction' | 'label' | 'narrowLabel'>,
  passed: boolean,
): PipelineLaneModel {
  return {
    ...base,
    state: passed ? 'passed' : 'idle',
    tone: 'info',
  };
}

function applyForwardTransition(
  uiBe: PipelineWirePair,
  beDb: PipelineWirePair,
  fromOrder: number,
  toOrder: number,
  tone: TraceStep['status'],
): void {
  if (fromOrder === 0 && toOrder >= 1) {
    uiBe.forward = { ...uiBe.forward, state: 'active', tone };
  }
  if (toOrder === 2 && fromOrder <= 1) {
    beDb.forward = { ...beDb.forward, state: 'active', tone };
  }
}

function applyReverseTransition(
  uiBe: PipelineWirePair,
  beDb: PipelineWirePair,
  fromOrder: number,
  toOrder: number,
  tone: TraceStep['status'],
): void {
  if (fromOrder === 2 && toOrder <= 1) {
    beDb.reverse = { ...beDb.reverse, state: 'active', tone };
  }
  if (toOrder === 0 && fromOrder >= 1) {
    uiBe.reverse = { ...uiBe.reverse, state: 'active', tone };
  }
}

function applyActiveTransition(
  uiBe: PipelineWirePair,
  beDb: PipelineWirePair,
  prev: TraceStep | null,
  active: TraceStep | null,
): void {
  if (!prev || !active || prev.layer === active.layer) {
    return;
  }
  const fromOrder = LAYER_ORDER[prev.layer];
  const toOrder = LAYER_ORDER[active.layer];
  if (toOrder > fromOrder) {
    applyForwardTransition(uiBe, beDb, fromOrder, toOrder, active.status);
    return;
  }
  applyReverseTransition(uiBe, beDb, fromOrder, toOrder, active.status);
}

function isBlockedBeforeDb(trace: readonly TraceStep[], activeIndex: number): boolean {
  if (trace.length === 0 || activeIndex < 0) {
    return false;
  }
  const hasDbSteps = trace.some((step) => step.layer === 'database');
  if (hasDbSteps) {
    return false;
  }
  return trace
    .slice(0, activeIndex + 1)
    .some((step) => step.layer === 'backend' && step.status === 'safe');
}

/**
 * Format a compact directional hop badge between two consecutive trace steps.
 *
 * @param prev - Previous trace step, or null on the opening step.
 * @param active - Current trace step, or null when idle.
 * @returns Human-readable Vietnamese route tag (e.g. `UI → FastAPI`).
 */
export function formatHopRoute(prev: TraceStep | null, active: TraceStep | null): string {
  if (!active) {
    return 'Sẵn sàng';
  }
  if (!prev) {
    return `${LAYER_SHORT[active.layer]} · Bắt đầu`;
  }
  if (prev.layer === active.layer) {
    return `${LAYER_SHORT[active.layer]} · xử lý nội bộ`;
  }
  const forward = LAYER_ORDER[active.layer] > LAYER_ORDER[prev.layer];
  return forward
    ? `${LAYER_SHORT[prev.layer]} → ${LAYER_SHORT[active.layer]}`
    : `${LAYER_SHORT[prev.layer]} → ${LAYER_SHORT[active.layer]} (trả về)`;
}

/**
 * Derive dual-lane directional wire states, DB block gate status, hop badge, and real wire
 * hover payloads purely from the active trace and execution envelope.
 *
 * @param trace - Ordered execution trace steps.
 * @param activeIndex - 0-based active trace index (-1 when idle).
 * @param lastRequest - Last non-silent execution request, or null.
 * @param lastResponse - Last non-silent execution response, or null.
 * @returns Complete derived PipelineTraceModel for FlowPipeline rendering.
 */
export function derivePipelineModel(
  trace: readonly TraceStep[],
  activeIndex: number,
  lastRequest: LastExecutionRequest | null,
  lastResponse: LabExecutionResponse | null,
): PipelineTraceModel {
  const activeStep = activeIndex >= 0 ? (trace[activeIndex] ?? null) : null;
  const prevStep = activeIndex > 0 ? (trace[activeIndex - 1] ?? null) : null;
  const blockedBeforeDb = isBlockedBeforeDb(trace, activeIndex);

  const passed = scanPassedLanes(trace, activeIndex);
  const uiBe: PipelineWirePair = {
    forward: makeLane(
      { key: 'uiBeFwd', direction: 'forward', label: 'HTTP đi', narrowLabel: 'Đi' },
      passed.uiBeFwd,
    ),
    reverse: makeLane(
      { key: 'uiBeRev', direction: 'reverse', label: 'Trả về', narrowLabel: 'Về' },
      passed.uiBeRev,
    ),
  };
  const beDb: PipelineWirePair = {
    forward: makeLane(
      { key: 'beDbFwd', direction: 'forward', label: 'SQL', narrowLabel: 'SQL' },
      passed.beDbFwd,
    ),
    reverse: makeLane(
      { key: 'beDbRev', direction: 'reverse', label: 'Kết quả', narrowLabel: 'KQ' },
      passed.beDbRev,
    ),
  };

  applyActiveTransition(uiBe, beDb, prevStep, activeStep);

  if (blockedBeforeDb) {
    beDb.forward = {
      ...beDb.forward,
      state: 'blocked',
      tone: 'safe',
      gateLabel: 'Chặn DB',
      narrowGateLabel: 'Chặn',
    };
    beDb.reverse = { ...beDb.reverse, state: 'muted', tone: 'info' };
  }

  return {
    uiBe,
    beDb,
    blockedBeforeDb,
    isSelfLoop: Boolean(prevStep && activeStep && prevStep.layer === activeStep.layer),
    activeStep,
    prevStep,
    hopRoute: formatHopRoute(prevStep, activeStep),
    wirePayloads: buildWirePayloads(trace, lastRequest, lastResponse, blockedBeforeDb),
  };
}
