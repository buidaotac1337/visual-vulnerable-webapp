import { useRef } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import { UI_LABELS } from '@/lib';
import type { TracePlaybackSpeed } from '@/types';

import { Tooltip } from '../ui';

/** Props for the Dark IDE trace playback speed selector. */
export interface TraceSpeedSwitchProps {
  speed: TracePlaybackSpeed;
  onChange: (nextSpeed: TracePlaybackSpeed) => void;
}

const SPEED_OPTIONS: readonly {
  id: TracePlaybackSpeed;
  key: 'speedManual' | 'speedHalf' | 'speedNormal' | 'speedDouble';
}[] = [
  { id: 'manual', key: 'speedManual' },
  { id: '0.5x', key: 'speedHalf' },
  { id: '1x', key: 'speedNormal' },
  { id: '2x', key: 'speedDouble' },
];

function nextSpeedIndex(key: string, current: number, length: number): number | null {
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
 * Render the 4-option trace playback speed selector (`Tay`, `0.5×`, `1×`, `2×`)
 * as an accessible WAI-ARIA radiogroup styled for the Dark IDE footer.
 *
 * @param props - Active playback speed and change callback.
 * @returns Accessible speed segmented control element.
 */
export function TraceSpeedSwitch({ speed, onChange }: TraceSpeedSwitchProps): JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    SPEED_OPTIONS.findIndex((option) => option.id === speed),
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const nextIndex = nextSpeedIndex(event.key, activeIndex, SPEED_OPTIONS.length);
    const nextOption = nextIndex === null ? undefined : SPEED_OPTIONS[nextIndex];
    if (nextIndex === null || nextOption === undefined) {
      return;
    }
    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
    onChange(nextOption.id);
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/70 p-0.5">
      <span className="px-1.5 text-xs font-medium text-slate-400">Tốc độ</span>
      <div
        role="radiogroup"
        aria-label="Tốc độ phát trace"
        onKeyDown={handleKeyDown}
        className="inline-flex items-center gap-0.5"
      >
        {SPEED_OPTIONS.map(({ id, key }, index) => {
          const isActive = id === speed;
          const label = UI_LABELS[key];
          return (
            <Tooltip key={id} tip={label.tip} side="top" align="end">
              <button
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(id)}
                className={`cursor-pointer rounded-md px-2 py-0.5 text-xs transition-colors duration-150 ${
                  isActive
                    ? 'bg-slate-100 font-semibold text-slate-900 shadow-xs'
                    : 'font-medium text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label.text}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
