import { useRef } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { Columns2, Maximize2, Minimize2, PanelLeft } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { LabMode, WorkspaceLayoutMode, WorkspaceNotice } from '@/types';

import { Tooltip } from '../ui';

import { SplitDivider } from './SplitDivider';

interface LabWorkspaceProps {
  mode: LabMode;
  notice: WorkspaceNotice | null;
  leftPane: ReactNode;
  rightPane: ReactNode;
  layoutMode?: WorkspaceLayoutMode;
  splitPercent?: number;
  isFloatingCollapsed?: boolean;
  onChangeSplit?: (nextPercent: number) => void;
  onResetSplit?: () => void;
  onToggleFloatingCollapsed?: () => void;
  onChangeLayoutMode?: (nextMode: WorkspaceLayoutMode) => void;
}

const NOTICE_STYLES: Record<WorkspaceNotice['tone'], string> = {
  info: 'border-info-200 bg-info-50 text-info-800',
  safe: 'border-safe-200 bg-safe-50 text-safe-800',
  danger: 'border-danger-200 bg-danger-50 text-danger-800',
};

const NOOP = (): void => undefined;

interface NormalizedLayoutOptions {
  layoutMode: WorkspaceLayoutMode;
  splitPercent: number;
  isFloatingCollapsed: boolean;
  onChangeSplit: (nextPercent: number) => void;
  onResetSplit: () => void;
  onToggleFloatingCollapsed: () => void;
  onChangeLayoutMode: (nextMode: WorkspaceLayoutMode) => void;
}

function normalizeLayoutOptions(props: LabWorkspaceProps): NormalizedLayoutOptions {
  return {
    layoutMode: props.layoutMode ?? 'split',
    splitPercent: props.splitPercent ?? 50,
    isFloatingCollapsed: props.isFloatingCollapsed ?? false,
    onChangeSplit: props.onChangeSplit ?? NOOP,
    onResetSplit: props.onResetSplit ?? NOOP,
    onToggleFloatingCollapsed: props.onToggleFloatingCollapsed ?? NOOP,
    onChangeLayoutMode: props.onChangeLayoutMode ?? NOOP,
  };
}

interface WorkspaceLayoutClasses {
  mainCols: string;
  sandboxSection: string;
  sandboxBody: string;
}

function buildWorkspaceClasses(
  layoutMode: WorkspaceLayoutMode,
  isFloatingCollapsed: boolean,
): WorkspaceLayoutClasses {
  if (layoutMode === 'code-focus') {
    return {
      mainCols: 'lg:grid-cols-1',
      sandboxSection: 'flex min-h-0 flex-col bg-[var(--bg-sandbox)] lg:hidden',
      sandboxBody: 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5',
    };
  }
  if (layoutMode === 'floating') {
    const sizeClass = isFloatingCollapsed
      ? 'lg:w-auto lg:max-w-[calc(100%-2rem)]'
      : 'lg:max-h-[calc(100%-9rem)] lg:w-[440px] lg:max-w-[46vw]';
    const bodyLgClass = isFloatingCollapsed ? 'lg:hidden' : 'lg:p-4';
    return {
      mainCols: 'lg:grid-cols-1',
      sandboxSection: `flex min-h-0 flex-col bg-[var(--bg-sandbox)] lg:absolute lg:top-14 lg:right-4 lg:z-30 lg:rounded-xl lg:border lg:border-slate-300 lg:shadow-2xl ${sizeClass}`,
      sandboxBody: `flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-b-[11px] p-5 ${bodyLgClass}`,
    };
  }
  return {
    mainCols: 'lg:grid-cols-[minmax(0,var(--vvwa-split))_6px_minmax(0,1fr)]',
    sandboxSection: 'flex min-h-0 flex-col bg-[var(--bg-sandbox)]',
    sandboxBody: 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5',
  };
}

interface FloatingSandboxHeaderProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onDockSplit: () => void;
}

function FloatingSandboxHeader({
  isCollapsed,
  onToggleCollapsed,
  onDockSplit,
}: FloatingSandboxHeaderProps): JSX.Element {
  return (
    <div
      className={`hidden shrink-0 items-center justify-between gap-3 bg-white px-3.5 py-2 lg:flex ${
        isCollapsed ? 'rounded-[11px]' : 'rounded-t-[11px] border-b border-slate-200'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
        <PanelLeft className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <span>MiniShop Sandbox</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip
          tip={
            isCollapsed
              ? 'Mở rộng thẻ MiniShop Sandbox để thao tác form.'
              : 'Thu gọn thẻ MiniShop Sandbox để xem toàn bộ Code Inspector.'
          }
          side="bottom"
        >
          <button
            type="button"
            aria-expanded={!isCollapsed}
            onClick={onToggleCollapsed}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {isCollapsed ? (
              <>
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Mở rộng</span>
              </>
            ) : (
              <>
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Thu gọn</span>
              </>
            )}
          </button>
        </Tooltip>

        <Tooltip tip={UI_LABELS.layoutRestoreSplit.tip} side="bottom" align="end">
          <button
            type="button"
            onClick={onDockSplit}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{UI_LABELS.layoutRestoreSplit.text}</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function CodeFocusBanner({ onRestoreSplit }: { onRestoreSplit: () => void }): JSX.Element {
  return (
    <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 lg:flex">
      <span>Chế độ Tập trung code — MiniShop Sandbox đang ẩn.</span>
      <Tooltip tip={UI_LABELS.layoutRestoreSplit.tip} align="end">
        <button
          type="button"
          onClick={onRestoreSplit}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-100 hover:border-brand-400 hover:text-white"
        >
          <Columns2 className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
          <span>{UI_LABELS.layoutRestoreSplit.text}</span>
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * Render the Dual-Surface Pedagogy workspace under TopControlBar supporting 3 desktop
 * layout modes (`split`, `code-focus`, `floating`) while keeping both panes mounted so
 * local Sandbox state is preserved across layout transitions.
 *
 * @param props - Active mode, notice, pane elements, and optional layout mode controls.
 * @returns Rendered main workspace container.
 */
export function LabWorkspace(props: LabWorkspaceProps): JSX.Element {
  const { mode, notice, leftPane, rightPane } = props;
  const opts = normalizeLayoutOptions(props);
  const mainRef = useRef<HTMLElement | null>(null);
  const modeBorder = mode === 'secure' ? 'border-t-safe-500' : 'border-t-danger-500';
  const classes = buildWorkspaceClasses(opts.layoutMode, opts.isFloatingCollapsed);
  const splitStyle =
    opts.layoutMode === 'split'
      ? ({ '--vvwa-split': `${String(opts.splitPercent)}%` } as CSSProperties)
      : undefined;

  return (
    <main
      ref={mainRef}
      style={splitStyle}
      className={`relative grid min-h-0 flex-1 grid-cols-1 border-t-2 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden ${classes.mainCols} ${modeBorder}`}
    >
      <section key="sandbox" aria-label="MiniShop Sandbox" className={classes.sandboxSection}>
        {opts.layoutMode === 'floating' ? (
          <FloatingSandboxHeader
            isCollapsed={opts.isFloatingCollapsed}
            onToggleCollapsed={opts.onToggleFloatingCollapsed}
            onDockSplit={() => opts.onChangeLayoutMode('split')}
          />
        ) : null}
        <div className={classes.sandboxBody}>
          {notice && (
            <div
              role="status"
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${NOTICE_STYLES[notice.tone]}`}
            >
              {notice.message}
            </div>
          )}
          {leftPane}
        </div>
      </section>

      {opts.layoutMode === 'split' ? (
        <SplitDivider
          key="divider"
          splitPercent={opts.splitPercent}
          containerRef={mainRef}
          onChangeSplit={opts.onChangeSplit}
          onResetSplit={opts.onResetSplit}
        />
      ) : null}

      <section
        key="inspector"
        aria-label="Code & Trace Inspector"
        className="vvwa-ide-scroll flex min-h-0 flex-col overflow-hidden border-t border-slate-700 bg-[var(--bg-ide)] text-slate-100 lg:border-t-0"
      >
        {opts.layoutMode === 'code-focus' ? (
          <CodeFocusBanner onRestoreSplit={() => opts.onChangeLayoutMode('split')} />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">{rightPane}</div>
      </section>
    </main>
  );
}
