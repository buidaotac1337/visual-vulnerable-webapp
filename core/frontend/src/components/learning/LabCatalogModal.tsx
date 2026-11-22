import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { CheckCircle2, Compass, Search, X } from 'lucide-react';

import type { LabStepProgress } from '@/hooks';
import type { LabMetadata } from '@/types';

/** Props for the 9-lab learning roadmap and catalog modal. */
export interface LabCatalogModalProps {
  isOpen: boolean;
  labs: readonly LabMetadata[];
  selectedLabId: string | null;
  getLabProgress: (labId: string) => LabStepProgress;
  onSelectLab: (labId: string) => void;
  onClose: () => void;
}

type DifficultyFilter = 'Tất cả' | 'Cơ bản' | 'Trung bình';
const DIFFICULTY_FILTERS: readonly DifficultyFilter[] = ['Tất cả', 'Cơ bản', 'Trung bình'];

function LabCatalogItem({
  lab,
  index,
  isSelected,
  progress,
  onPick,
}: {
  lab: LabMetadata;
  index: number;
  isSelected: boolean;
  progress: LabStepProgress;
  onPick: () => void;
}): JSX.Element {
  const diffTone =
    lab.difficulty.trim().toLowerCase() === 'cơ bản'
      ? 'bg-safe-100 text-safe-800'
      : 'bg-warning-100 text-warning-800';
  const dots = [
    progress.exploredVulnerable,
    progress.comparedSecure,
    progress.viewedDiff,
    progress.passedVerify,
  ];
  return (
    <li
      className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center ${
        isSelected ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{lab.title}</h3>
          <span className="rounded-full bg-info-100 px-2 py-0.5 text-xs font-medium text-info-800">
            {lab.category}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diffTone}`}>
            {lab.difficulty}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{lab.summary}</p>
        <div className="flex items-center gap-2.5 pt-0.5">
          <span className="inline-flex items-center gap-1" aria-label="Tiến độ 4 bước">
            {dots.map((done, idx) => (
              <span
                key={idx}
                className={`h-2 w-2 rounded-full ${done ? 'bg-safe-500' : 'bg-slate-200'}`}
              />
            ))}
          </span>
          {progress.passedVerify ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-safe-100 px-2 py-0.5 text-xs font-semibold text-safe-800">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>Đã vượt qua</span>
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onPick}
        className={`shrink-0 cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold ${
          isSelected
            ? 'border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {isSelected ? 'Đang học' : 'Bắt đầu học'}
      </button>
    </li>
  );
}

/**
 * Render the native `<dialog>` catalog modal displaying the 9-lab curriculum,
 * overall completion progress, difficulty filters, search input, and per-lab status.
 *
 * @param props - Modal open state, lab list, progress lookup, and selection callbacks.
 * @returns Rendered LabCatalogModal dialog element, or `null` when closed.
 */
export function LabCatalogModal({
  isOpen,
  labs,
  selectedLabId,
  getLabProgress,
  onSelectLab,
  onClose,
}: LabCatalogModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('Tất cả');
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [isOpen]);

  const passedCount = useMemo(
    () => labs.filter((lab) => getLabProgress(lab.id).passedVerify).length,
    [labs, getLabProgress],
  );
  const filteredLabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labs.filter((lab) => {
      const okDiff =
        difficulty === 'Tất cả' || lab.difficulty.trim().toLowerCase() === difficulty.toLowerCase();
      if (!okDiff) return false;
      if (!q) return true;
      return (
        lab.title.toLowerCase().includes(q) ||
        lab.category.toLowerCase().includes(q) ||
        lab.summary.toLowerCase().includes(q)
      );
    });
  }, [labs, difficulty, query]);

  if (!isOpen) return null;
  const totalLabs = labs.length;
  const percent = totalLabs > 0 ? Math.round((passedCount / totalLabs) * 100) : 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vvwa-catalog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Compass className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="vvwa-catalog-title" className="text-base font-semibold text-slate-900">
                Lộ trình học {totalLabs} bài lab bảo mật
              </h2>
              <p className="text-xs text-slate-600">
                Đã hoàn thành {passedCount} / {totalLabs} bài lab
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng danh sách bài lab"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ hoàn thành lộ trình"
          aria-valuenow={passedCount}
          aria-valuemin={0}
          aria-valuemax={totalLabs}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full bg-safe-500 transition-all duration-200"
            style={{ width: `${String(percent)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Lọc theo mức độ" className="flex flex-wrap gap-1.5">
            {DIFFICULTY_FILTERS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={difficulty === level}
                onClick={() => setDifficulty(level)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium ${
                  difficulty === level
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc nhóm..."
              aria-label="Tìm kiếm bài lab"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none sm:w-60"
            />
          </label>
        </div>
      </div>
      <div className="max-h-[65vh] overflow-y-auto bg-slate-50/50 p-4">
        {filteredLabs.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-600">
            Không tìm thấy bài lab nào phù hợp với bộ lọc hiện tại.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {filteredLabs.map((lab) => {
              const idx = labs.findIndex((item) => item.id === lab.id);
              return (
                <LabCatalogItem
                  key={lab.id}
                  lab={lab}
                  index={idx >= 0 ? idx : 0}
                  isSelected={lab.id === selectedLabId}
                  progress={getLabProgress(lab.id)}
                  onPick={() => {
                    onSelectLab(lab.id);
                    onClose();
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
