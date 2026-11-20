import type { JSX } from 'react';
import { ChevronLeft, ChevronRight, Play, Shield } from 'lucide-react';

import type { PlaybackStatus } from '@/types';

interface TraceControlsProps {
  totalSteps: number;
  activeIndex: number;
  status: PlaybackStatus;
  safetyPattern: string | null;
  onPrev: () => void;
  onReplay: () => void;
  onNext: () => void;
}

/**
 * Render trace playback controls (Prev / Replay / Next) and the lesson Safety Pattern box
 * anchored at the bottom of the Dark IDE Inspector surface.
 *
 * @param props - Playback position, controls callbacks, and safetyPattern summary.
 * @returns Rendered footer panel for CodeInspector.
 */
export function TraceControls({
  totalSteps,
  activeIndex,
  status,
  safetyPattern,
  onPrev,
  onReplay,
  onNext,
}: TraceControlsProps): JSX.Element {
  const hasTrace = totalSteps > 0;
  const currentStep = hasTrace && activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-slate-700 bg-[var(--bg-ide-header)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!hasTrace || activeIndex <= 0}
            onClick={onPrev}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trước</span>
          </button>

          <button
            type="button"
            disabled={!hasTrace}
            onClick={onReplay}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-indigo-500/60 bg-indigo-600/20 px-2.5 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-600/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{status === 'playing' ? 'Đang chạy...' : 'Replay'}</span>
          </button>

          <button
            type="button"
            disabled={!hasTrace || activeIndex >= totalSteps - 1}
            onClick={onNext}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Sau</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <span className="text-xs font-medium text-slate-400">
          {hasTrace ? `Bước ${currentStep} / ${totalSteps}` : 'Chưa có trace thực thi'}
        </span>
      </div>

      {safetyPattern && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-emerald-300">Safety Pattern: </strong>
            {safetyPattern}
          </p>
        </div>
      )}
    </div>
  );
}
