import { Pause, Play, RotateCcw } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { PlaybackStatus, TracePlaybackSpeed, TraceStep } from '@/types';

/** Props for the Dark IDE trace playback footer controls. */
export interface TraceControlsProps {
  totalSteps: number;
  activeIndex: number;
  status: PlaybackStatus;
  safetyPattern: string | null;
  steps?: readonly TraceStep[];
  speed?: TracePlaybackSpeed;
  onPrev: () => void;
  onReplay: () => void;
  onTogglePlayPause?: () => void;
  onNext: () => void;
  onChangeSpeed?: (speed: TracePlaybackSpeed) => void;
  onJumpToStep?: (index: number) => void;
}

/** Derived display state for the Play / Pause / Replay toggle button. */
export interface PlayButtonState {
  label: string;
  tip: string;
  Icon: typeof Play;
}

/** Normalized metrics and fallback callbacks consumed by TraceControls. */
export interface NormalizedControls {
  hasTrace: boolean;
  currentStep: number;
  progressPercent: number;
  steps: readonly TraceStep[];
  speed: TracePlaybackSpeed;
  onTogglePlayPause: () => void;
  onChangeSpeed: (speed: TracePlaybackSpeed) => void;
  onJumpToStep: (index: number) => void;
}

const NOOP = (): void => undefined;

/**
 * Resolve label, tooltip, and Lucide icon for the Play / Pause / Replay button.
 *
 * @param status - Current playback lifecycle status.
 * @param hasTrace - Whether any trace steps are loaded.
 * @param activeIndex - Zero-based active step index.
 * @param totalSteps - Total number of steps in the trace.
 * @returns Button label, tooltip string, and icon component.
 */
export function resolvePlayButtonState(
  status: PlaybackStatus,
  hasTrace: boolean,
  activeIndex: number,
  totalSteps: number,
): PlayButtonState {
  if (status === 'playing') {
    return { label: UI_LABELS.pauseTrace.text, tip: UI_LABELS.pauseTrace.tip, Icon: Pause };
  }
  if (hasTrace && (status === 'completed' || activeIndex >= totalSteps - 1)) {
    return { label: UI_LABELS.replayTrace.text, tip: UI_LABELS.replayTrace.tip, Icon: RotateCcw };
  }
  return { label: UI_LABELS.playTrace.text, tip: UI_LABELS.playTrace.tip, Icon: Play };
}

/**
 * Normalize optional TraceControls props and compute progress bar metrics.
 *
 * @param props - Incoming TraceControlsProps.
 * @returns Normalized trace playback flags, percentages, and safe callbacks.
 */
export function normalizeControlsProps(props: TraceControlsProps): NormalizedControls {
  const hasTrace = props.totalSteps > 0;
  const currentStep = hasTrace && props.activeIndex >= 0 ? props.activeIndex + 1 : 0;
  const progressPercent =
    hasTrace && currentStep > 0 ? Math.round((currentStep / props.totalSteps) * 100) : 0;
  return {
    hasTrace,
    currentStep,
    progressPercent,
    steps: props.steps ?? [],
    speed: props.speed ?? '1x',
    onTogglePlayPause: props.onTogglePlayPause ?? props.onReplay,
    onChangeSpeed: props.onChangeSpeed ?? NOOP,
    onJumpToStep: props.onJumpToStep ?? NOOP,
  };
}
