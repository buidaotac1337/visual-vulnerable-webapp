import type { TraceStatus } from '@/types';

/** Short uppercase Vietnamese security status labels used in FlowPipeline badges. */
export const PIPELINE_STATUS_LABELS: Record<TraceStatus, string> = {
  info: 'BÌNH THƯỜNG',
  safe: 'ĐÃ CHẶN',
  warning: 'NGUY CƠ',
  danger: 'KHAI THÁC',
};

/** Pill badge styling per semantic trace status. */
export const STATUS_PILL_CLASSES: Record<TraceStatus, string> = {
  info: 'border-info-200 bg-info-50 text-info-700',
  safe: 'border-safe-200 bg-safe-50 text-safe-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-800',
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
};

/** Solid dot indicator styling per semantic trace status. */
export const SOLID_DOT_CLASSES: Record<TraceStatus, string> = {
  info: 'bg-info-500',
  safe: 'bg-safe-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

/** High-contrast dot styling on dark slate popover headers. */
export const POPOVER_DOT_CLASSES: Record<TraceStatus, string> = {
  info: 'bg-info-400',
  safe: 'bg-safe-400',
  warning: 'bg-warning-400',
  danger: 'bg-danger-400',
};

/** Node icon accent tint once a node has been visited. */
export const NODE_ICON_CLASSES: Record<TraceStatus, string> = {
  info: 'text-info-600',
  safe: 'text-safe-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

/** Active node border, fill, and subtle ring styling. */
export const NODE_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'border-solid border-info-500 bg-info-50 ring-3 ring-info-500/15',
  safe: 'border-solid border-safe-500 bg-safe-50 ring-3 ring-safe-500/15',
  warning: 'border-solid border-warning-500 bg-warning-50 ring-3 ring-warning-500/15',
  danger: 'border-solid border-danger-500 bg-danger-50 ring-3 ring-danger-500/15',
};

/** Completed node border and soft tint styling. */
export const NODE_COMPLETED_CLASSES: Record<TraceStatus, string> = {
  info: 'border-solid border-info-200 bg-info-50/40',
  safe: 'border-solid border-safe-200 bg-safe-50/40',
  warning: 'border-solid border-warning-200 bg-warning-50/40',
  danger: 'border-solid border-danger-200 bg-danger-50/40',
};

/** Active directional wire label colors. */
export const LANE_LABEL_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'font-bold text-info-700',
  safe: 'font-bold text-safe-700',
  warning: 'font-bold text-warning-800',
  danger: 'font-bold text-danger-700',
};

/** Active directional wire rail colors. */
export const LANE_LINE_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'bg-info-200',
  safe: 'bg-safe-200',
  warning: 'bg-warning-200',
  danger: 'bg-danger-200',
};

/** Active directional wire arrowhead colors. */
export const LANE_ARROW_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'text-info-600',
  safe: 'text-safe-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

/** Active traveling packet dot styling per semantic trace status. */
export const PACKET_DOT_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'bg-info-600 ring-3 ring-info-500/25',
  safe: 'bg-safe-600 ring-3 ring-safe-500/25',
  warning: 'bg-warning-600 ring-3 ring-warning-500/25',
  danger: 'bg-danger-600 ring-3 ring-danger-500/25',
};

/** Live data packet strip container tinting per active step status. */
export const PACKET_STRIP_CLASSES: Record<TraceStatus, string> = {
  info: 'border-info-200 bg-info-50/40',
  safe: 'border-safe-200 bg-safe-50/45',
  warning: 'border-warning-200 bg-warning-50/45',
  danger: 'border-danger-200 bg-danger-50/45',
};

/** Active Full Data Journey timeline row accenting. */
export const JOURNEY_ACTIVE_CLASSES: Record<TraceStatus, string> = {
  info: 'border-info-200 border-l-info-500 bg-info-50',
  safe: 'border-safe-200 border-l-safe-500 bg-safe-50',
  warning: 'border-warning-200 border-l-warning-500 bg-warning-50',
  danger: 'border-danger-200 border-l-danger-500 bg-danger-50',
};
