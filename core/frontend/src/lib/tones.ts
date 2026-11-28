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
  /** Text one step stronger, for body copy on `bg` (notices, callouts). */
  textBolder: string;
  /** Hover state of `bgBold`, with its `hover:` variant (full literal for Tailwind). */
  bgBoldHovered: string;
  /** Border in this tone. */
  border: string;
  /** Soft border around a `bg` tinted box. */
  borderSubtle: string;
  /** Icon colour (lucide icons use currentColor). */
  icon: string;
}

/** Single source of truth mapping each tone to its token-backed utility classes. */
export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  neutral: {
    text: 'text-subtle',
    textBolder: 'text-default',
    bg: 'bg-neutral',
    bgSubtler: 'bg-neutral-hovered',
    bgBold: 'bg-neutral-bold',
    bgBoldHovered: 'hover:bg-neutral-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-default',
    borderSubtle: 'border-default',
    icon: 'text-icon-subtle',
  },
  brand: {
    text: 'text-brand',
    textBolder: 'text-brand',
    bg: 'bg-brand-subtlest',
    bgSubtler: 'bg-brand-subtlest-hovered',
    bgBold: 'bg-brand-bold',
    bgBoldHovered: 'hover:bg-brand-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-brand',
    borderSubtle: 'border-brand-subtle',
    icon: 'text-icon-brand',
  },
  information: {
    text: 'text-information',
    textBolder: 'text-information-bolder',
    bg: 'bg-information',
    bgSubtler: 'bg-information-subtler',
    bgBold: 'bg-information-bold',
    bgBoldHovered: 'hover:bg-information-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-information',
    borderSubtle: 'border-information-subtle',
    icon: 'text-icon-information',
  },
  success: {
    text: 'text-success',
    textBolder: 'text-success-bolder',
    bg: 'bg-success',
    bgSubtler: 'bg-success-subtler',
    bgBold: 'bg-success-bold',
    bgBoldHovered: 'hover:bg-success-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-success',
    borderSubtle: 'border-success-subtle',
    icon: 'text-icon-success',
  },
  warning: {
    text: 'text-warning',
    textBolder: 'text-warning-bolder',
    bg: 'bg-warning',
    bgSubtler: 'bg-warning-subtler',
    bgBold: 'bg-warning-bold',
    bgBoldHovered: 'hover:bg-warning-bold-hovered',
    onBold: 'text-warning-inverse',
    border: 'border-warning',
    borderSubtle: 'border-warning-subtle',
    icon: 'text-icon-warning',
  },
  danger: {
    text: 'text-danger',
    textBolder: 'text-danger-bolder',
    bg: 'bg-danger',
    bgSubtler: 'bg-danger-subtler',
    bgBold: 'bg-danger-bold',
    bgBoldHovered: 'hover:bg-danger-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-danger',
    borderSubtle: 'border-danger-subtle',
    icon: 'text-icon-danger',
  },
  discovery: {
    text: 'text-discovery',
    textBolder: 'text-discovery-bolder',
    bg: 'bg-discovery',
    bgSubtler: 'bg-discovery-subtler',
    bgBold: 'bg-discovery-bold',
    bgBoldHovered: 'hover:bg-discovery-bold-hovered',
    onBold: 'text-inverse',
    border: 'border-discovery',
    borderSubtle: 'border-discovery-subtle',
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
