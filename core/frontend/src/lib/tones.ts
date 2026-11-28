import type { TraceOutcome, TraceStatus, WorkspaceMode } from '@/types';

/** Semantic colour role from the design tokens (ADR-0012). */
export type Tone =
  | 'neutral'
  | 'brand'
  | 'information'
  | 'success'
  | 'warning'
  | 'danger'
  | 'discovery';

/**
 * Utility classes of one tone. Every value is a complete literal class name so Tailwind can
 * find it when scanning sources; never build these names by string concatenation.
 */
export interface ToneClasses {
  /** Coloured text on a neutral surface. */
  text: string;
  /** Tinted background for badges, notices, and callouts. */
  bg: string;
  /** Stronger tint than `bg` (hover of a tinted row, emphasised callout). */
  bgSubtler: string;
  /** Solid fill: status dots, solid badges, primary buttons. */
  bgBold: string;
  /** Text and icon colour on top of `bgBold`. */
  onBold: string;
  /** Border in this tone. */
  border: string;
  /** Icon colour (lucide icons use currentColor). */
  icon: string;
}

/** Single source of truth mapping each tone to its token-backed utility classes. */
export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  neutral: {
    text: 'text-subtle',
    bg: 'bg-neutral',
    bgSubtler: 'bg-neutral-hovered',
    bgBold: 'bg-neutral-bold',
    onBold: 'text-inverse',
    border: 'border-default',
    icon: 'text-icon-subtle',
  },
  brand: {
    text: 'text-brand',
    bg: 'bg-brand-subtlest',
    bgSubtler: 'bg-brand-subtlest-hovered',
    bgBold: 'bg-brand-bold',
    onBold: 'text-inverse',
    border: 'border-brand',
    icon: 'text-icon-brand',
  },
  information: {
    text: 'text-information',
    bg: 'bg-information',
    bgSubtler: 'bg-information-subtler',
    bgBold: 'bg-information-bold',
    onBold: 'text-inverse',
    border: 'border-information',
    icon: 'text-icon-information',
  },
  success: {
    text: 'text-success',
    bg: 'bg-success',
    bgSubtler: 'bg-success-subtler',
    bgBold: 'bg-success-bold',
    onBold: 'text-inverse',
    border: 'border-success',
    icon: 'text-icon-success',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning',
    bgSubtler: 'bg-warning-subtler',
    bgBold: 'bg-warning-bold',
    onBold: 'text-warning-inverse',
    border: 'border-warning',
    icon: 'text-icon-warning',
  },
  danger: {
    text: 'text-danger',
    bg: 'bg-danger',
    bgSubtler: 'bg-danger-subtler',
    bgBold: 'bg-danger-bold',
    onBold: 'text-inverse',
    border: 'border-danger',
    icon: 'text-icon-danger',
  },
  discovery: {
    text: 'text-discovery',
    bg: 'bg-discovery',
    bgSubtler: 'bg-discovery-subtler',
    bgBold: 'bg-discovery-bold',
    onBold: 'text-inverse',
    border: 'border-discovery',
    icon: 'text-icon-discovery',
  },
};

/** Trace step status → tone (`safe` stays the API value; its colour role is `success`). */
export const TRACE_STATUS_TONE: Readonly<Record<TraceStatus, Tone>> = {
  info: 'information',
  warning: 'warning',
  danger: 'danger',
  safe: 'success',
};

/** Execution outcome → tone. */
export const TRACE_OUTCOME_TONE: Readonly<Record<TraceOutcome, Tone>> = {
  exploited: 'danger',
  blocked: 'success',
  normal: 'neutral',
  error: 'warning',
};

/** Workspace mode → tone (Vulnerable is danger, Secure is success, Song song is brand). */
export const WORKSPACE_MODE_TONE: Readonly<Record<WorkspaceMode, Tone>> = {
  vulnerable: 'danger',
  secure: 'success',
  compare: 'brand',
};

/**
 * Return the token-backed utility classes of a tone.
 *
 * @param tone - Semantic colour role.
 * @returns Literal class names for text, backgrounds, border, and icon.
 */
export function toneClasses(tone: Tone): ToneClasses {
  return TONE_CLASSES[tone];
}
