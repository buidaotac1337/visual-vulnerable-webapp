import { statusToneClasses } from '@/lib';
import type { ToneClasses } from '@/lib';
import type { TraceStatus } from '@/types';

/** Short uppercase Vietnamese security status labels used in FlowPipeline badges. */
export const PIPELINE_STATUS_LABELS: Record<TraceStatus, string> = {
  info: 'BÌNH THƯỜNG',
  safe: 'ĐÃ CHẶN',
  warning: 'NGUY CƠ',
  danger: 'KHAI THÁC',
};

const STATUSES: readonly TraceStatus[] = ['info', 'safe', 'warning', 'danger'];

/** Build a per-status class map from the status tone (lib/tones.ts is the SSOT, ADR-0012). */
function byStatus(pick: (tone: ToneClasses) => string): Record<TraceStatus, string> {
  const entries = STATUSES.map((status) => [status, pick(statusToneClasses(status))] as const);
  return Object.fromEntries(entries) as Record<TraceStatus, string>;
}

/** Pill badge styling per semantic trace status. */
export const STATUS_PILL_CLASSES = byStatus((t) => `${t.borderSubtle} ${t.bg} ${t.text}`);

/** Solid dot indicator per semantic trace status (pipeline and popover headers). */
export const SOLID_DOT_CLASSES = byStatus((t) => t.bgBold);

/** Dot styling in the (always dark) popover header; same tone, resolved in its dark scope. */
export const POPOVER_DOT_CLASSES = SOLID_DOT_CLASSES;

/** Node icon accent tint once a node has been visited. */
export const NODE_ICON_CLASSES = byStatus((t) => t.icon);

/** Active node border, fill, and soft ring. */
export const NODE_ACTIVE_CLASSES = byStatus(
  (t) => `border-solid ${t.border} ${t.bg} ring-3 ${t.ringSubtle}`,
);

/** Completed node border and soft tint. */
export const NODE_COMPLETED_CLASSES = byStatus((t) => `border-solid ${t.borderSubtle} ${t.bg}`);

/** Active directional wire label colours. */
export const LANE_LABEL_ACTIVE_CLASSES = byStatus((t) => `font-bold ${t.text}`);

/** Active directional wire rail colours. */
export const LANE_LINE_ACTIVE_CLASSES = byStatus((t) => t.bgSubtler);

/** Active directional wire arrowhead colours. */
export const LANE_ARROW_ACTIVE_CLASSES = byStatus((t) => t.icon);

/** Active travelling packet dot per semantic trace status. */
export const PACKET_DOT_ACTIVE_CLASSES = byStatus((t) => `${t.bgBold} ring-3 ${t.ringSubtle}`);

/** Live data packet strip container tint per active step status. */
export const PACKET_STRIP_CLASSES = byStatus((t) => `${t.borderSubtle} ${t.bg}`);

/** Active Full Data Journey timeline row accent. */
export const JOURNEY_ACTIVE_CLASSES = byStatus((t) => `${t.borderSubtle} ${t.borderLeft} ${t.bg}`);
