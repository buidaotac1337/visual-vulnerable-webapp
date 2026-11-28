import type { JSX } from 'react';
import { BookOpen, Compass } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { LabMetadata } from '@/types';

import { Tooltip } from '../ui';

interface ToolbarLabNavProps {
  labs: readonly LabMetadata[];
  selectedLabId: string;
  passedLabsCount: number;
  onSelectLab: (labId: string) => void;
  onOpenCatalog?: () => void;
  onOpenGlossary?: () => void;
}

/**
 * Render the lab dropdown selector paired with the Beginner Learning Path catalog
 * button (with completion counter) and the Security Glossary button.
 *
 * @param props - Available labs, active selection, completion count, and modal callbacks.
 * @returns Rendered navigation controls for the left side of TopControlBar.
 */
export function ToolbarLabNav({
  labs,
  selectedLabId,
  passedLabsCount,
  onSelectLab,
  onOpenCatalog,
  onOpenGlossary,
}: ToolbarLabNavProps): JSX.Element {
  return (
    <>
      <label className="sr-only" htmlFor="vvwa-lab-selector">
        Chọn bài lab
      </label>
      <select
        id="vvwa-lab-selector"
        aria-label="Chọn bài lab"
        disabled={labs.length === 0}
        value={selectedLabId}
        onChange={(event) => onSelectLab(event.target.value)}
        className="min-w-40 max-w-[190px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 xl:max-w-[240px] 2xl:max-w-xs"
      >
        {labs.length === 0 ? (
          <option value="">Chưa có bài lab trong labs/</option>
        ) : (
          labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.title}
            </option>
          ))
        )}
      </select>

      {onOpenCatalog && (
        <Tooltip tip={UI_LABELS.labCatalog.tip} align="start">
          <button
            type="button"
            onClick={onOpenCatalog}
            aria-label={UI_LABELS.labCatalog.text}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">{UI_LABELS.labCatalog.text}</span>
            {labs.length > 0 && (
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                {passedLabsCount}/{labs.length}
              </span>
            )}
          </button>
        </Tooltip>
      )}

      {onOpenGlossary && (
        <Tooltip tip={UI_LABELS.glossary.tip} align="start">
          <button
            type="button"
            onClick={onOpenGlossary}
            aria-label={UI_LABELS.glossary.text}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
            <span className="hidden 2xl:inline">{UI_LABELS.glossary.text}</span>
          </button>
        </Tooltip>
      )}
    </>
  );
}
