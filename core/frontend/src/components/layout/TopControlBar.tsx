import { memo } from 'react';
import type { JSX } from 'react';
import { CheckCircle2, Download, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';

import { isFrontendVerifyTest, testMyFixTip, UI_LABELS } from '@/lib';
import type { HealthResponse, LabMetadata, LabMode, WorkspaceLayoutMode } from '@/types';

import { Tooltip } from '../ui';

import { LayoutModeSwitch } from './LayoutModeSwitch';
import { ModeSwitch } from './ModeSwitch';
import { ToolbarLabNav } from './ToolbarLabNav';

interface TopControlBarProps {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  selectedLab: LabMetadata | null;
  mode: LabMode;
  layoutMode?: WorkspaceLayoutMode;
  passedLabsCount?: number;
  isResettingDb: boolean;
  isVerifying: boolean;
  isDownloading: boolean;
  onSelectLab: (labId: string) => void;
  onChangeMode: (nextMode: LabMode) => void;
  onChangeLayoutMode?: (nextMode: WorkspaceLayoutMode) => void;
  onOpenCatalog?: () => void;
  onOpenGlossary?: () => void;
  onResetDb: () => void;
  onVerify: () => void;
  onDownloadSnippet: () => void;
}

function renderApiBadge(health: HealthResponse | null, apiError: string | null): JSX.Element {
  if (health) {
    return (
      <span
        className="hidden shrink-0 whitespace-nowrap rounded-full bg-safe-50 px-2.5 py-1 text-xs font-medium text-safe-700 xl:inline-flex"
        title={`${health.service} (${health.environment})`}
      >
        API: {health.status.toUpperCase()} (v{health.version})
      </span>
    );
  }
  if (apiError) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700">
        {apiError}
      </span>
    );
  }
  return (
    <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 xl:inline-flex">
      Connecting API...
    </span>
  );
}

interface StableLabelProps {
  label: string;
  busyLabel: string;
  isBusy: boolean;
}

function StableLabel({ label, busyLabel, isBusy }: StableLabelProps): JSX.Element {
  return (
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
 * Render the fixed 56px top navigation bar housing lab selection, learning path,
 * glossary, mode toggle, and 1-click Reset DB / Test My Fix / Download Snippet controls.
 *
 * @param props - Workspace status, labs list, and toolbar action callbacks.
 * @returns Rendered TopControlBar header element.
 */
function TopControlBarInner({
  health,
  apiError,
  labs,
  selectedLab,
  mode,
  layoutMode = 'split',
  passedLabsCount = 0,
  isResettingDb,
  isVerifying,
  isDownloading,
  onSelectLab,
  onChangeMode,
  onChangeLayoutMode,
  onOpenCatalog,
  onOpenGlossary,
  onResetDb,
  onVerify,
  onDownloadSnippet,
}: TopControlBarProps): JSX.Element {
  const isSecure = mode === 'secure';
  const hasLab = selectedLab !== null;
  const gradesFrontend = selectedLab?.verifyTests.some(isFrontendVerifyTest) ?? false;
  const verifyTip = testMyFixTip(gradesFrontend);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-2 text-base font-semibold text-slate-900">
          {isSecure ? (
            <ShieldCheck className="h-5 w-5 text-safe-500" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-danger-500" aria-hidden="true" />
          )}
          <span className="tracking-tight">VVWA · MiniShop</span>
        </div>

        <ToolbarLabNav
          labs={labs}
          selectedLabId={selectedLab?.id ?? ''}
          passedLabsCount={passedLabsCount}
          onSelectLab={onSelectLab}
          onOpenCatalog={onOpenCatalog}
          onOpenGlossary={onOpenGlossary}
        />

        {renderApiBadge(health, apiError)}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ModeSwitch mode={mode} hasFrontendSink={gradesFrontend} onChange={onChangeMode} />

        <LayoutModeSwitch
          mode={layoutMode}
          onChange={(nextMode) => onChangeLayoutMode?.(nextMode)}
        />

        <Tooltip tip={UI_LABELS.resetDb.tip}>
          <button
            type="button"
            onClick={onResetDb}
            disabled={isResettingDb}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <StableLabel
              label={UI_LABELS.resetDb.text}
              busyLabel={UI_LABELS.resetDb.busy}
              isBusy={isResettingDb}
            />
          </button>
        </Tooltip>

        <Tooltip tip={verifyTip}>
          <button
            type="button"
            onClick={onVerify}
            disabled={!hasLab || isVerifying}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <StableLabel
              label={UI_LABELS.testMyFix.text}
              busyLabel={UI_LABELS.testMyFix.busy}
              isBusy={isVerifying}
            />
          </button>
        </Tooltip>

        <Tooltip tip={UI_LABELS.downloadSnippet.tip} align="end">
          <button
            type="button"
            onClick={onDownloadSnippet}
            disabled={!hasLab || isDownloading}
            aria-label={UI_LABELS.downloadSnippet.text}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{UI_LABELS.downloadSnippet.text}</span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

/**
 * Memoized 56px top navigation bar housing lab selection, learning path, glossary,
 * mode toggle, and 1-click Reset DB / Test My Fix / Download Snippet controls.
 */
export const TopControlBar = memo(TopControlBarInner);
