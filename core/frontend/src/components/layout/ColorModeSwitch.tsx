import type { JSX } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ColorModePreference } from '@/hooks';
import { UI_LABELS } from '@/lib';
import type { UiLabel } from '@/lib';

import { Tooltip } from '../ui';

/** Props for the light / dark / system colour-mode button. */
export interface ColorModeSwitchProps {
  preference: ColorModePreference;
  onChange: (next: ColorModePreference) => void;
}

const MODES: Record<
  ColorModePreference,
  { icon: LucideIcon; label: UiLabel; next: ColorModePreference }
> = {
  light: { icon: Sun, label: UI_LABELS.colorModeLight, next: 'dark' },
  dark: { icon: Moon, label: UI_LABELS.colorModeDark, next: 'auto' },
  auto: { icon: Monitor, label: UI_LABELS.colorModeAuto, next: 'light' },
};

/**
 * Render a compact button cycling the app theme Sáng → Tối → Theo hệ thống (ADR-0012).
 * The Code Inspector stays dark in every mode.
 *
 * @param props - Saved preference and the change callback.
 * @returns Icon button with a tooltip naming the current mode.
 */
export function ColorModeSwitch({ preference, onChange }: ColorModeSwitchProps): JSX.Element {
  const { icon: Icon, label, next } = MODES[preference];
  return (
    <Tooltip tip={label.tip ?? label.text} align="end">
      <button
        type="button"
        onClick={() => onChange(next)}
        aria-label={`Giao diện: ${label.text}`}
        data-color-preference={preference}
        className="inline-flex cursor-pointer items-center justify-center rounded-large border border-default bg-surface-raised p-1.5 text-subtle hover:bg-neutral-subtle-hovered"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
