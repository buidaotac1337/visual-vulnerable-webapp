import type {
  LabExecutionResponse,
  LastExecutionRequest,
  PipelineWireKey,
  PipelineWirePayload,
  TraceStatus,
  TraceStep,
} from '@/types';

import { ACTOR_HEADER } from './api';
import { compactJson, findLayerIndices, outcomeToStatus, prettyJson } from './pipelineWireFormat';

function buildUiBeFwdPayload(
  trace: readonly TraceStep[],
  lastRequest: LastExecutionRequest | null,
): PipelineWirePayload {
  const feIndices = findLayerIndices(trace, 'frontend');
  const stepIndex = feIndices[0] ?? (trace.length > 0 ? 0 : null);
  const firstStep = stepIndex !== null ? (trace[stepIndex] ?? null) : null;
  const status: TraceStatus = firstStep?.status ?? 'info';

  if (lastRequest) {
    const path = `/api/labs/${lastRequest.labId}/${lastRequest.mode}/${lastRequest.action}`;
    const headers = ['Content-Type: application/json'];
    if (lastRequest.actor) {
      headers.push(`${ACTOR_HEADER}: ${lastRequest.actor}`);
    }
    return {
      key: 'uiBeFwd',
      stepIndex,
      status,
      label: 'HTTP Request · UI → FastAPI',
      compact: `POST ${path}  ${compactJson(lastRequest.body)}`,
      full: `POST ${path} HTTP/1.1\n${headers.join('\n')}\n\n${prettyJson(lastRequest.body)}`,
    };
  }

  if (firstStep) {
    return {
      key: 'uiBeFwd',
      stepIndex,
      status,
      label: 'HTTP Request · UI → FastAPI',
      compact: firstStep.detail,
      full: `-- Bước ${String(firstStep.step)} · ${firstStep.title}\n${firstStep.detail}`,
    };
  }

  return {
    key: 'uiBeFwd',
    stepIndex: null,
    status: 'info',
    label: 'HTTP Request · UI → FastAPI',
    compact: 'Chưa có yêu cầu HTTP nào được gửi từ MiniShop UI.',
    full: 'Hãy thực thi một hành động trên MiniShop Sandbox để xem gói tin HTTP gửi lên FastAPI.',
  };
}

function buildBlockedDbPayload(trace: readonly TraceStep[]): PipelineWirePayload {
  const backendIndices = findLayerIndices(trace, 'backend');
  const safeIndices = backendIndices.filter((idx) => trace[idx]?.status === 'safe');
  const stepIndex =
    safeIndices[safeIndices.length - 1] ?? backendIndices[backendIndices.length - 1] ?? null;
  const blocker = stepIndex !== null ? (trace[stepIndex] ?? null) : null;
  const lines = backendIndices.map((idx, pos) => {
    const step = trace[idx];
    return step ? `${String(pos + 1)}. ${step.title}: ${step.detail}` : '';
  });

  return {
    key: 'beDbFwd',
    stepIndex,
    status: 'safe',
    label: 'Cổng chặn trước DB · FastAPI ✕ PostgreSQL',
    compact: blocker
      ? `Đã chặn tại FastAPI: ${blocker.title} — ${blocker.detail}`
      : 'Đã chặn tại FastAPI -> 0 truy vấn SQL.',
    full: [
      '-- FastAPI đã chặn yêu cầu trước khi chạm PostgreSQL:',
      ...lines.filter(Boolean),
      '-> 0 truy vấn SQL được gửi tới PostgreSQL.',
    ].join('\n'),
  };
}

function pickDbFwdStatus(prepStep: TraceStep | null, dbStep: TraceStep): TraceStatus {
  if (prepStep?.status === 'danger' || dbStep.status === 'danger') {
    return 'danger';
  }
  return prepStep?.status ?? dbStep.status;
}

function formatStepBlock(step: TraceStep): string {
  return `-- Bước ${String(step.step)} · ${step.title}\n${step.detail}`;
}

function buildDbActiveFwdPayload(
  trace: readonly TraceStep[],
  firstDbIdx: number,
): PipelineWirePayload {
  const dbStep = trace[firstDbIdx];
  const prevStep = firstDbIdx > 0 ? (trace[firstDbIdx - 1] ?? null) : null;
  const prepStep = prevStep?.layer === 'backend' ? prevStep : null;
  const steps = [prepStep, dbStep ?? null].filter((item): item is TraceStep => item !== null);
  return {
    key: 'beDbFwd',
    stepIndex: firstDbIdx,
    status: dbStep ? pickDbFwdStatus(prepStep, dbStep) : 'info',
    label: 'SQL / Truy vấn · FastAPI → PostgreSQL',
    compact: steps[0]?.detail ?? 'Truy vấn tới PostgreSQL.',
    full: steps.map(formatStepBlock).join('\n\n'),
  };
}

function buildBeDbFwdPayload(
  trace: readonly TraceStep[],
  blockedBeforeDb: boolean,
): PipelineWirePayload {
  if (blockedBeforeDb) {
    return buildBlockedDbPayload(trace);
  }
  const firstDbIdx = findLayerIndices(trace, 'database')[0];
  if (firstDbIdx !== undefined) {
    return buildDbActiveFwdPayload(trace, firstDbIdx);
  }
  const isEmpty = trace.length === 0;
  return {
    key: 'beDbFwd',
    stepIndex: null,
    status: 'info',
    label: 'SQL / Truy vấn · FastAPI → PostgreSQL',
    compact: isEmpty
      ? 'Chưa có truy vấn SQL nào được gửi tới PostgreSQL.'
      : 'Luồng thực thi hiện tại không gửi truy vấn tới PostgreSQL.',
    full: isEmpty
      ? 'Chạy một hành động trên MiniShop Sandbox để quan sát câu lệnh SQL gửi xuống PostgreSQL.'
      : 'Hành động này kết thúc tại FastAPI hoặc trình duyệt mà không gọi tới PostgreSQL.',
  };
}

function buildBeDbRevPayload(
  trace: readonly TraceStep[],
  blockedBeforeDb: boolean,
): PipelineWirePayload {
  if (blockedBeforeDb) {
    return {
      key: 'beDbRev',
      stepIndex: null,
      status: 'safe',
      label: 'Chặn trước khi tới DB',
      compact: 'PostgreSQL không nhận truy vấn nào vì FastAPI đã chặn từ trước.',
      full: 'PostgreSQL không nhận truy vấn nào vì FastAPI đã chặn từ trước.\nKhông có bản ghi nào bị đọc hay thay đổi.',
    };
  }
  const dbIndices = findLayerIndices(trace, 'database');
  const lastDbIdx = dbIndices[dbIndices.length - 1];
  if (lastDbIdx !== undefined) {
    const lastDb = trace[lastDbIdx];
    const detailLines = dbIndices.map((idx) => {
      const step = trace[idx];
      return step ? `Bước ${String(step.step)} · ${step.title}\n${step.detail}` : '';
    });
    return {
      key: 'beDbRev',
      stepIndex: lastDbIdx,
      status: lastDb?.status ?? 'info',
      label: 'Kết quả DB · PostgreSQL → FastAPI',
      compact: lastDb ? `${lastDb.title} — ${lastDb.detail}` : 'PostgreSQL đã trả kết quả.',
      full: detailLines.filter(Boolean).join('\n\n'),
    };
  }

  return {
    key: 'beDbRev',
    stepIndex: null,
    status: 'info',
    label: 'Kết quả DB · PostgreSQL → FastAPI',
    compact: 'Chưa có dữ liệu trả về từ PostgreSQL.',
    full: 'Chặng này sẽ hiển thị bản ghi hoặc kết quả cập nhật trả về từ PostgreSQL sau khi truy vấn chạy.',
  };
}

function buildUiBeRevFromResponse(
  lastResponse: LabExecutionResponse,
  trailingFe: TraceStep | null,
  stepIndex: number | null,
  label: string,
): PipelineWirePayload {
  const status = trailingFe?.status ?? outcomeToStatus(lastResponse.meta.outcome);
  const envelope = prettyJson({ meta: lastResponse.meta, data: lastResponse.data });
  const feNote = trailingFe
    ? `\n\n-- MiniShop UI xử lý phản hồi (Bước ${String(trailingFe.step)}):\n${trailingFe.title}: ${trailingFe.detail}`
    : '';
  return {
    key: 'uiBeRev',
    stepIndex,
    status,
    label,
    compact: `HTTP 200 · outcome="${lastResponse.meta.outcome}" · ${compactJson(lastResponse.data)}`,
    full: `HTTP/1.1 200 OK\nContent-Type: application/json\n\n${envelope}${feNote}`,
  };
}

function buildUiBeRevFallback(
  trace: readonly TraceStep[],
  stepIndex: number | null,
  label: string,
): PipelineWirePayload {
  const lastStep = stepIndex !== null ? (trace[stepIndex] ?? null) : null;
  if (lastStep) {
    return {
      key: 'uiBeRev',
      stepIndex,
      status: lastStep.status,
      label,
      compact: `${lastStep.title} — ${lastStep.detail}`,
      full: formatStepBlock(lastStep),
    };
  }
  return {
    key: 'uiBeRev',
    stepIndex: null,
    status: 'info',
    label,
    compact: 'Chưa có phản hồi HTTP nào từ FastAPI.',
    full: 'Phản hồi JSON từ FastAPI trả về cho MiniShop UI sẽ xuất hiện tại đây sau khi bạn thực thi lab.',
  };
}

function buildUiBeRevPayload(
  trace: readonly TraceStep[],
  lastResponse: LabExecutionResponse | null,
): PipelineWirePayload {
  const feIndices = findLayerIndices(trace, 'frontend').filter((idx) => idx > 0);
  const trailingFeIdx = feIndices[feIndices.length - 1];
  const trailingFe = trailingFeIdx !== undefined ? (trace[trailingFeIdx] ?? null) : null;
  const stepIndex = trailingFeIdx ?? (trace.length > 0 ? trace.length - 1 : null);
  const label =
    lastResponse?.meta.outcome === 'blocked'
      ? 'HTTP Response (Đã chặn) · FastAPI → UI'
      : 'HTTP Response · FastAPI → UI';

  if (lastResponse) {
    return buildUiBeRevFromResponse(lastResponse, trailingFe, stepIndex, label);
  }
  return buildUiBeRevFallback(trace, stepIndex, label);
}

/**
 * Synthesize compact and full wire hover payloads for all 4 directional FlowPipeline lanes
 * directly from real lab execution data (request, trace steps, and HTTP response).
 *
 * @param trace - Merged execution trace steps.
 * @param lastRequest - Last non-silent request sent from MiniShop Sandbox, or null.
 * @param lastResponse - Last non-silent LabExecutionResponse returned by FastAPI, or null.
 * @param blockedBeforeDb - True when FastAPI blocked execution before any DB query ran.
 * @returns Keyed map of hover payload models for all 4 wire lanes.
 */
export function buildWirePayloads(
  trace: readonly TraceStep[],
  lastRequest: LastExecutionRequest | null,
  lastResponse: LabExecutionResponse | null,
  blockedBeforeDb: boolean,
): Record<PipelineWireKey, PipelineWirePayload> {
  return {
    uiBeFwd: buildUiBeFwdPayload(trace, lastRequest),
    beDbFwd: buildBeDbFwdPayload(trace, blockedBeforeDb),
    beDbRev: buildBeDbRevPayload(trace, blockedBeforeDb),
    uiBeRev: buildUiBeRevPayload(trace, lastResponse),
  };
}
