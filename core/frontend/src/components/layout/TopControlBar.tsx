import { memo } from 'react';
import type { JSX } from 'react';
import {
  CheckCircle2,
  Columns2,
  Download,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  isFrontendVerifyTest,
  testMyFixTip,
  toneClasses,
  UI_LABELS,
  WORKSPACE_MODE_TONE,
} from '@/lib';
import type {
  HealthResponse,
  LabMetadata,
  ModeOutcomes,
  WorkspaceLayoutMode,
  WorkspaceMode,
} from '@/types';

import { Tooltip } from '../ui';

import { LayoutModeSwitch } from './LayoutModeSwitch';
import { ModeSwitch } from './ModeSwitch';
import { ToolbarLabNav } from './ToolbarLabNav';

interface TopControlBarProps {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  selectedLab: LabMetadata | null;
  mode: WorkspaceMode;
  modeOutcomes?: ModeOutcomes;
  layoutMode?: WorkspaceLayoutMode;
  passedLabsCount?: number;
  isResettingDb: boolean;
  isVerifying: boolean;
  isDownloading: boolean;
  onSelectLab: (labId: string) => void;
  onChangeMode: (nextMode: WorkspaceMode) => void;
  onChangeLayoutMode?: (nextMode: WorkspaceLayoutMode) => void;
  onOpenCatalog?: () => void;
  onOpenGlossary?: () => void;
  onResetDb: () => void;
  onVerify: () => void;
  onDownloadSnippet: () => void;
}

const BRAND_ICONS = { vulnerable: ShieldAlert, secure: ShieldCheck, compare: Columns2 } as const;

function renderApiBadge(health: HealthResponse | null, apiError: string | null): JSX.Element {
  if (health) {
    return (
      <span
        className="hidden shrink-0 whitespace-nowrap rounded-full bg-success px-2.5 py-1 text-xs font-medium text-success 2xl:inline-flex"
        title={`${health.service} (${health.environment})`}
      >
        API: {health.status.toUpperCase()} (v{health.version})
      </span>
    );
  }
  if (apiError) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-warning px-2.5 py-1 text-xs font-medium text-warning">
        {apiError}
      </span>
    );
  }
  return (
    <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-neutral px-2.5 py-1 text-xs font-medium text-subtle 2xl:inline-flex">
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
  modeOutcomes,
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
  const BrandIcon = BRAND_ICONS[mode];
  const hasLab = selectedLab !== null;
  const gradesFrontend = selectedLab?.verifyTests.some(isFrontendVerifyTest) ?? false;
  const verifyTip = testMyFixTip(gradesFrontend);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-default bg-surface-raised px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-2 text-base font-semibold text-default">
          <BrandIcon
            className={`h-5 w-5 ${toneClasses(WORKSPACE_MODE_TONE[mode]).icon}`}
            aria-hidden="true"
          />
          <span className="tracking-tight">
            VVWA<span className="hidden xl:inline"> · MiniShop</span>
          </span>
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
        <ModeSwitch
          mode={mode}
          hasFrontendSink={gradesFrontend}
          outcomes={modeOutcomes}
          onChange={onChangeMode}
        />

        <LayoutModeSwitch
          mode={layoutMode}
          onChange={(nextMode) => onChangeLayoutMode?.(nextMode)}
        />

        <Tooltip tip={UI_LABELS.resetDb.tip}>
          <button
            type="button"
            onClick={onResetDb}
            disabled={isResettingDb}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-large border border-default bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-subtle hover:bg-neutral-subtle-hovered disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only 2xl:not-sr-only">
              <StableLabel
                label={UI_LABELS.resetDb.text}
                busyLabel={UI_LABELS.resetDb.busy}
                isBusy={isResettingDb}
              />
            </span>
          </button>
        </Tooltip>

        <Tooltip tip={verifyTip}>
          <button
            type="button"
            onClick={onVerify}
            disabled={!hasLab || isVerifying}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-large bg-brand-bold px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-brand-bold-hovered disabled:cursor-not-allowed disabled:opacity-50"
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-large border border-default bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-subtle hover:bg-neutral-subtle-hovered disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden 2xl:inline">{UI_LABELS.downloadSnippet.text}</span>
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
