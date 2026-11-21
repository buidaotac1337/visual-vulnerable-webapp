import type { JSX } from 'react';
import { UserRound } from 'lucide-react';

interface ActorSwitcherProps {
  actors: readonly string[];
  actor: string | null;
  disabled: boolean;
  onChange: (name: string) => void;
}

/**
 * Persona picker simulating "who is logged in". The choice travels as the
 * X-VVWA-Actor session header, never inside the editable payload (ADR-0005).
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
  if (actors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <UserRound className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
        <span id="actor-switcher-label">Đang đăng nhập với tư cách</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="actor-switcher-label"
        className="flex flex-wrap gap-2"
      >
        {actors.map((name) => {
          const isActive = name === actor;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(name)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Phiên đăng nhập do engine cấp qua header{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>X-VVWA-Actor</code>, tách khỏi payload bạn
        chỉnh sửa.
      </p>
    </div>
  );
}
