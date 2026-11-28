import { useRef } from 'react';
import type { JSX, KeyboardEvent, ReactNode } from 'react';

export interface SubTabItem<T extends string = string> {
  /** Tab identifier passed back to onChange. */
  id: T;
  /** Visible tab label. */
  label: string;
  /** Optional leading icon rendered next to the label. */
  icon?: ReactNode;
  /** Optional HTML id on the tab button (paired with aria-labelledby on a tabpanel). */
  buttonId?: string;
  /** Optional id of the controlled tabpanel (sets aria-controls). */
  controlsId?: string;
}

export interface SubTabBarProps<T extends string = string> {
  /** Accessible name for the horizontal tablist. */
  ariaLabel: string;
  /** Ordered list of sub-tab items. */
  items: readonly SubTabItem<T>[];
  /** Currently selected tab id. */
  activeId: T;
  /** Called when the active tab changes via click or arrow/Home/End keys. */
  onChange: (id: T) => void;
  /** Optional extra classes on the tablist container. */
  className?: string;
}

function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count === 0) {
    return null;
  }
  if (key === 'ArrowRight') {
    return (index + 1) % count;
  }
  if (key === 'ArrowLeft') {
    return (index - 1 + count) % count;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return count - 1;
  }
  return null;
}

/**
 * Accessible horizontal sub-tab bar (WAI-ARIA tablist) for MiniShop card headers.
 *
 * @param props - Tab definitions, active id, accessible label, and change handler.
 * @returns Rendered tablist with keyboard arrow/Home/End navigation.
 */
export function SubTabBar<T extends string>({
  ariaLabel,
  items,
  activeId,
  onChange,
  className,
}: SubTabBarProps<T>): JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const nextIndex = nextTabIndex(event.key, index, items.length);
    if (nextIndex === null) {
      return;
    }
    const target = items[nextIndex];
    if (!target) {
      return;
    }
    event.preventDefault();
    onChange(target.id);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={['flex gap-1', className].filter(Boolean).join(' ')}
    >
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            id={item.buttonId}
            type="button"
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            aria-controls={item.controlsId}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-large px-2.5 py-1 text-xs font-medium ${
              isActive
                ? 'bg-brand-bold text-inverse'
                : 'bg-neutral text-subtle hover:bg-neutral-hovered'
            }`}
          >
            {item.icon ? (
              <span className="inline-flex shrink-0" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
