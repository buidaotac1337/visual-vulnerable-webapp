import { useRef } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { Code2, Columns2, PictureInPicture2 } from 'lucide-react';

import { UI_LABELS } from '@/lib';
import type { WorkspaceLayoutMode } from '@/types';

import { Tooltip } from '../ui';

interface LayoutModeSwitchProps {
  mode: WorkspaceLayoutMode;
  onChange: (nextMode: WorkspaceLayoutMode) => void;
}

interface LayoutOption {
  id: WorkspaceLayoutMode;
  label: string;
  tip: string;
  Icon: typeof Columns2;
}

const LAYOUT_OPTIONS: readonly LayoutOption[] = [
  {
    id: 'split',
    label: UI_LABELS.layoutSplit.text,
    tip: UI_LABELS.layoutSplit.tip,
    Icon: Columns2,
  },
  {
    id: 'code-focus',
    label: UI_LABELS.layoutCodeFocus.text,
    tip: UI_LABELS.layoutCodeFocus.tip,
    Icon: Code2,
  },
  {
    id: 'floating',
    label: UI_LABELS.layoutFloating.text,
    tip: UI_LABELS.layoutFloating.tip,
    Icon: PictureInPicture2,
  },
];

function targetIndexForKey(key: string, current: number, length: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % length;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + length) % length;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return null;
  }
}

/**
 * Render the 3-mode desktop workspace layout switcher (`Chia đôi`, `Tập trung code`,
 * `Sandbox nổi`) as an accessible WAI-ARIA radiogroup hidden below the `lg` breakpoint.
 *
 * @param props - Active layout mode and change callback.
 * @returns Accessible layout mode segmented control element.
 */
export function LayoutModeSwitch({ mode, onChange }: LayoutModeSwitchProps): JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    LAYOUT_OPTIONS.findIndex((item) => item.id === mode),
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const nextIndex = targetIndexForKey(event.key, activeIndex, LAYOUT_OPTIONS.length);
    const nextOption = nextIndex === null ? undefined : LAYOUT_OPTIONS[nextIndex];
    if (nextIndex === null || nextOption === undefined) {
      return;
    }
    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
    onChange(nextOption.id);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Bố cục workspace"
      onKeyDown={handleKeyDown}
      className="hidden items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 lg:inline-flex"
    >
      {LAYOUT_OPTIONS.map(({ id, label, tip, Icon }, index) => {
        const isActive = id === mode;
        return (
          <Tooltip key={id} tip={tip}>
            <button
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={label}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors duration-150 ${
                isActive
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs'
                  : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden 2xl:inline">{label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
