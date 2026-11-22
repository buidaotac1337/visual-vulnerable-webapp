import { useEffect, useRef } from 'react';

/** Options controlling global keyboard shortcuts for trace playback. */
export interface UseTraceShortcutsOptions {
  /** Disable shortcuts when modals or overlays are open. */
  enabled: boolean;
  /** Whether an execution trace is currently loaded. */
  hasTrace: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlayPause: () => void;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ARROW_WIDGET_SELECTOR = '[role="radiogroup"], [role="tablist"], [role="separator"]';
const SPACE_WIDGET_SELECTOR =
  'button, a, [role="button"], [role="tab"], [role="radio"], [role="separator"]';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable) {
    return true;
  }
  return target.closest('[contenteditable="true"], [contenteditable=""]') !== null;
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return true;
  }
  return isEditableTarget(event.target);
}

function resolveShortcutAction(
  key: string,
  target: EventTarget | null,
  callbacks: Pick<UseTraceShortcutsOptions, 'onPrev' | 'onNext' | 'onTogglePlayPause'>,
): (() => void) | null {
  const element = target instanceof Element ? target : null;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (element?.closest(ARROW_WIDGET_SELECTOR)) {
      return null;
    }
    return key === 'ArrowLeft' ? callbacks.onPrev : callbacks.onNext;
  }
  if (key === ' ') {
    if (element?.closest(SPACE_WIDGET_SELECTOR)) {
      return null;
    }
    return callbacks.onTogglePlayPause;
  }
  return null;
}

/**
 * Bind safe global trace playback shortcuts (`ArrowLeft`, `ArrowRight`, `Space`) when
 * a trace is loaded and no modal blocks interaction, yielding to form controls and ARIA widgets.
 *
 * @param options - Enablement flags and playback action callbacks.
 */
export function useTraceShortcuts({
  enabled,
  hasTrace,
  onPrev,
  onNext,
  onTogglePlayPause,
}: UseTraceShortcutsOptions): void {
  const callbacksRef = useRef({ onPrev, onNext, onTogglePlayPause });
  callbacksRef.current = { onPrev, onNext, onTogglePlayPause };

  useEffect(() => {
    if (!enabled || !hasTrace) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (shouldIgnoreShortcut(event)) {
        return;
      }
      const action = resolveShortcutAction(event.key, event.target, callbacksRef.current);
      if (!action) {
        return;
      }
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, hasTrace]);
}
