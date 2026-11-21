import { useId, useRef } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { UserRound } from 'lucide-react';

interface ActorSwitcherProps {
  actors: readonly string[];
  actor: string | null;
  disabled: boolean;
  onChange: (name: string) => void;
}

/**
 * Map a WAI-ARIA radiogroup navigation key to the target index (wrapping around).
 *
 * @param key - KeyboardEvent.key value.
 * @param current - Index of the currently checked radio.
 * @param length - Number of radios in the group.
 * @returns Target index, or null when the key is not a navigation key.
 */
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
 * Persona picker simulating "who is logged in". The choice travels as the
 * X-VVWA-Actor session header, never inside the editable payload (ADR-0005).
 * Implements the WAI-ARIA radio group pattern: one tab stop, arrow keys move
 * focus and selection.
 *
 * @param props - Declared personas, active persona, and change handler.
 * @returns Accessible radiogroup, or null when the lab declares no actors.
 */
export function ActorSwitcher({
  actors,
  actor,
  disabled,
  onChange,
}: ActorSwitcherProps): JSX.Element | null {
  const labelId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (actors.length === 0) {
    return null;
  }

  const checkedIndex = Math.max(0, actor === null ? 0 : actors.indexOf(actor));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = targetIndexForKey(event.key, checkedIndex, actors.length);
    const name = target === null ? undefined : actors[target];
    if (target === null || name === undefined) {
      return;
    }
    event.preventDefault();
    buttonRefs.current[target]?.focus();
    onChange(name);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <UserRound className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
        <span id={labelId}>Đang đăng nhập với tư cách</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
        onKeyDown={disabled ? undefined : handleKeyDown}
      >
        {actors.map((name, index) => {
          const isActive = index === checkedIndex;
          return (
            <button
              key={name}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(name)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Phiên đăng nhập do engine cấp qua header{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>X-VVWA-Actor</code>, tách khỏi payload bạn
        chỉnh sửa.
      </p>
    </div>
  );
}
