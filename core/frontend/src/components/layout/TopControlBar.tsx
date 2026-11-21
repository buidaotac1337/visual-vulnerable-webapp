import type { JSX } from 'react';
import { CheckCircle2, Download, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';

import { isFrontendVerifyTest } from '@/lib';
import type { HealthResponse, LabMetadata, LabMode } from '@/types';

import { ModeSwitch } from './ModeSwitch';

interface TopControlBarProps {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  selectedLab: LabMetadata | null;
  mode: LabMode;
  isResettingDb: boolean;
  isVerifying: boolean;
  isDownloading: boolean;
  onSelectLab: (labId: string) => void;
  onChangeMode: (nextMode: LabMode) => void;
  onResetDb: () => void;
  onVerify: () => void;
  onDownloadSnippet: () => void;
}

function renderApiBadge(health: HealthResponse | null, apiError: string | null): JSX.Element {
  if (health) {
    return (
      <span
        className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 xl:inline-flex"
        title={`${health.service} (${health.environment})`}
      >
        API: {health.status.toUpperCase()} (v{health.version})
      </span>
    );
  }
  if (apiError) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        {apiError}
      </span>
    );
  }
  return (
    <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 xl:inline-flex">
      Connecting API...
    </span>
  );
}

interface StableLabelProps {
  label: string;
  busyLabel: string;
  isBusy: boolean;
}

/**
 * Button label that keeps the width of its longest text, so the toolbar does not shift
 * when a button switches to its busy text (works at any font size or zoom level).
 *
 * @param props - Idle text, busy text, and busy flag.
 * @returns Both texts stacked in one grid cell, only the current one visible.
 */
function StableLabel({ label, busyLabel, isBusy }: StableLabelProps): JSX.Element {
  return (
    // Both texts share one grid cell, so the cell is as wide as the wider text; the hidden
    // one is also aria-hidden, so the button's accessible name is the visible text.
    <span className="grid">
      <span aria-hidden={isBusy} className={`col-start-1 row-start-1 ${isBusy ? 'invisible' : ''}`}>
        {label}
      </span>
      <span
        aria-hidden={!isBusy}
        className={`col-start-1 row-start-1 ${isBusy ? '' : 'invisible'}`}
      >
        {busyLabel}
      </span>
    </span>
  );
}

/**
 * Render the fixed 56px top navigation bar housing lab selection, mode toggle,
 * and 1-click Reset DB / Test My Fix / Download Snippet controls.
 *
 * @param props - Workspace status, labs list, and toolbar action callbacks.
 * @returns Rendered TopControlBar header element.
 */
export function TopControlBar({
  health,
  apiError,
  labs,
  selectedLab,
  mode,
  isResettingDb,
  isVerifying,
  isDownloading,
  onSelectLab,
  onChangeMode,
  onResetDb,
  onVerify,
  onDownloadSnippet,
}: TopControlBarProps): JSX.Element {
  const isSecure = mode === 'secure';
  const hasLab = selectedLab !== null;
  const gradesFrontend = selectedLab?.verifyTests.some(isFrontendVerifyTest) ?? false;
  const verifyTitle = `Chấm bài làm của bạn trong backend/vulnerable.py${
    gradesFrontend ? ' và frontend/vulnerable.tsx' : ''
  } (ở chế độ nào cũng vậy)`;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 text-base font-semibold text-slate-900">
          {isSecure ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-red-500" aria-hidden="true" />
          )}
          <span className="tracking-tight">VVWA · MiniShop</span>
        </div>

        <label className="sr-only" htmlFor="vvwa-lab-selector">
          Chọn bài lab
        </label>
        <select
          id="vvwa-lab-selector"
          aria-label="Chọn bài lab"
          disabled={labs.length === 0}
          value={selectedLab?.id ?? ''}
          onChange={(event) => onSelectLab(event.target.value)}
          className="max-w-xs truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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

        {renderApiBadge(health, apiError)}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ModeSwitch mode={mode} onChange={onChangeMode} />

        <button
          type="button"
          onClick={onResetDb}
          disabled={isResettingDb}
          title="Khôi phục database MiniShop về dữ liệu mẫu ban đầu"
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <StableLabel label="Reset DB" busyLabel="Đang reset..." isBusy={isResettingDb} />
        </button>

        <button
          type="button"
          onClick={onVerify}
          disabled={!hasLab || isVerifying}
          title={verifyTitle}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <StableLabel label="Test My Fix" busyLabel="Đang kiểm thử..." isBusy={isVerifying} />
        </button>

        <button
          type="button"
          onClick={onDownloadSnippet}
          disabled={!hasLab || isDownloading}
          aria-label="Tải Snippet"
          title="Tải mã nguồn bản lỗi, bản vá, diff và README dạng .zip"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Tải Snippet</span>
        </button>
      </div>
    </header>
  );
}
