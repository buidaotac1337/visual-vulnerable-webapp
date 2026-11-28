import type { JSX } from 'react';
import { RefreshCw } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { InspectorTab, LabMode } from '@/types';

import { Tooltip } from '../ui';
import { CopyPathButton } from './CopyPathButton';

/** Props for the Dark IDE inspector tab bar and refresh header. */
export interface InspectorHeaderProps {
  activeTab: InspectorTab;
  mode: LabMode;
  frontendFileLabel: string | null;
  hasFrontendDiff: boolean;
  canRefresh: boolean;
  isRefreshing: boolean;
  fullFilePath?: string | null;
  onSelectTab: (tab: InspectorTab) => void;
  onRefreshSource: () => void;
}

const TAB_ITEMS: readonly { id: InspectorTab; label: string; tip: string }[] = [
  { id: 'backend', label: UI_LABELS.backendTab.text, tip: UI_LABELS.backendTab.tip },
  { id: 'frontend', label: UI_LABELS.frontendTab.text, tip: UI_LABELS.frontendTab.tip },
  { id: 'diff', label: UI_LABELS.diffTab.text, tip: UI_LABELS.diffTab.tip },
];

function resolveFileLabel(
  activeTab: InspectorTab,
  mode: LabMode,
  frontendFileLabel: string | null,
  hasFrontendDiff: boolean,
): string {
  if (activeTab === 'diff') {
    return hasFrontendDiff ? 'vulnerable ↔ secure (.py + .tsx)' : 'vulnerable.py ↔ secure.py';
  }
  if (activeTab === 'frontend') {
    return frontendFileLabel ?? 'frontend/LabView.tsx';
  }
  return `backend/${mode}.py`;
}

/**
 * Render the top tab bar (`Backend (.py)`, `Frontend (.tsx)`, `Diff`), active file label,
 * and manual disk refresh action for Code & Trace Inspector.
 *
 * @param props - Active tab, mode, resolved file metadata, and action callbacks.
 * @returns Rendered Dark IDE header bar element.
 */
export function InspectorHeader({
  activeTab,
  mode,
  frontendFileLabel,
  hasFrontendDiff,
  canRefresh,
  isRefreshing,
  fullFilePath = null,
  onSelectTab,
  onRefreshSource,
}: InspectorHeaderProps): JSX.Element {
  const hasFrontendSource = frontendFileLabel !== null;
  const activeFileLabel = resolveFileLabel(activeTab, mode, frontendFileLabel, hasFrontendDiff);

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-default bg-surface-sunken px-3 py-2">
      <div role="tablist" aria-label="Chế độ xem mã nguồn" className="flex items-center gap-1">
        {TAB_ITEMS.map((item) => {
          const isSelected = activeTab === item.id;
          const isDisabled = item.id === 'frontend' && !hasFrontendSource;
          return (
            <Tooltip
              key={item.id}
              tip={item.tip}
              align={item.id === 'backend' ? 'start' : 'center'}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => onSelectTab(item.id)}
                className={`cursor-pointer whitespace-nowrap rounded-medium px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? 'bg-surface text-default shadow-raised'
                    : 'text-subtle hover:bg-neutral-hovered hover:text-default'
                }`}
              >
                {item.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-subtle sm:inline font-mono">{activeFileLabel}</span>
        {fullFilePath && <CopyPathButton path={fullFilePath} />}
        <Tooltip tip={UI_LABELS.refreshSource.tip} align="end">
          <button
            type="button"
            onClick={onRefreshSource}
            disabled={!canRefresh || isRefreshing}
            aria-label={UI_LABELS.refreshSource.text}
            className="inline-flex cursor-pointer items-center gap-1 rounded-medium border border-default bg-neutral px-2 py-1 text-xs text-subtle hover:bg-neutral-hovered disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
