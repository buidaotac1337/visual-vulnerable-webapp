import type { TraceOutcome, TraceStatus, TraceStep } from '@/types';

const COMPACT_STR_LIMIT = 48;
const FULL_STR_LIMIT = 360;
const COMPACT_JSON_LIMIT = 96;

/**
 * Truncate a long string while showing how many characters were omitted.
 *
 * @param raw - Original string.
 * @param maxLen - Maximum visible character count before truncation.
 * @returns Original or clipped string.
 */
export function clipString(raw: string, maxLen: number): string {
  if (raw.length <= maxLen) {
    return raw;
  }
  const hidden = raw.length - maxLen;
  return `${raw.slice(0, maxLen)}... (+${String(hidden)} ký tự)`;
}

function summarizeValue(value: unknown, maxStrLen: number, depth = 0): unknown {
  if (typeof value === 'string') {
    return clipString(value, maxStrLen);
  }
  if (depth >= 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => summarizeValue(item, maxStrLen, depth + 1));
  }
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    next[key] = summarizeValue(entry, maxStrLen, depth + 1);
  }
  return next;
}

/**
 * Format an arbitrary JSON payload into a compact 1-line summary safe for wire tooltips.
 *
 * @param value - Payload object or primitive to summarize.
 * @returns Compact single-line JSON string.
 */
export function compactJson(value: unknown): string {
  const text = JSON.stringify(summarizeValue(value, COMPACT_STR_LIMIT));
  return text ? clipString(text, COMPACT_JSON_LIMIT) : '{}';
}

/**
 * Format an arbitrary JSON payload into indented multi-line JSON with huge strings clipped.
 *
 * @param value - Payload object or primitive to format.
 * @returns Indented JSON string.
 */
export function prettyJson(value: unknown): string {
  return JSON.stringify(summarizeValue(value, FULL_STR_LIMIT), null, 2) ?? '{}';
}

/**
 * Map a high-level lab execution outcome to its semantic FlowPipeline status tone.
 *
 * @param outcome - Backend execution outcome.
 * @returns Matching semantic TraceStatus.
 */
export function outcomeToStatus(outcome: TraceOutcome): TraceStatus {
  switch (outcome) {
    case 'exploited':
      return 'danger';
    case 'blocked':
      return 'safe';
    case 'error':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Collect all 0-based indices in a trace matching the requested architectural layer.
 *
 * @param trace - Ordered execution trace steps.
 * @param layer - Architectural layer filter.
 * @returns Matching 0-based step indices in ascending order.
 */
export function findLayerIndices(trace: readonly TraceStep[], layer: TraceStep['layer']): number[] {
  const result: number[] = [];
  trace.forEach((step, index) => {
    if (step.layer === layer) {
      result.push(index);
    }
  });
  return result;
}
