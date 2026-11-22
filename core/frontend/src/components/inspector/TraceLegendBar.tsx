import type { JSX } from 'react';

import type { InspectorTab, LabMode } from '@/types';

/** Props for the beginner-friendly trace color legend bar inside CodeInspector. */
export interface TraceLegendBarProps {
  hasTrace: boolean;
  activeTab: InspectorTab;
  mode: LabMode;
}

const LEGEND_ITEMS: readonly { label: string; dotClass: string }[] = [
  { label: 'Thông tin', dotClass: 'bg-info-400' },
  { label: 'Cảnh báo', dotClass: 'bg-warning-400' },
  { label: 'Lỗ hổng', dotClass: 'bg-danger-400' },
  { label: 'Đã chặn', dotClass: 'bg-safe-400' },
];

/**
 * Render a compact color legend for trace highlights on Dark IDE code tabs, plus a
 * one-line beginner onboarding tip before the first request is sent.
 *
 * @param props - Trace presence, active inspector tab, and current lab mode.
 * @returns Legend bar element, or null on the Diff tab.
 */
export function TraceLegendBar({
  hasTrace,
  activeTab,
  mode,
}: TraceLegendBarProps): JSX.Element | null {
  if (activeTab === 'diff') {
    return null;
  }

  return (
    <div
      data-mode={mode}
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-700/80 bg-[var(--bg-ide-header)]/60 px-3 py-1.5 text-[11px] text-slate-300"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-slate-400">Màu trace:</span>
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${item.dotClass}`} aria-hidden="true" />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
      {!hasTrace && (
        <span className="text-slate-400">
          Mẹo: chọn 1 Payload mẫu bên trái rồi bấm gửi — dòng code đang chạy sẽ tự sáng lên tại đây.
        </span>
      )}
    </div>
  );
}
