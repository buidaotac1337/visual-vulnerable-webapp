import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ColorModeSwitch } from '@/components';
import { COLOR_MODE_STORAGE_KEY, useColorMode } from '@/hooks';
import type { ColorModePreference } from '@/hooks';

function ControlledSwitch(): JSX.Element {
  const [preference, setPreference] = useState<ColorModePreference>('light');
  return <ColorModeSwitch preference={preference} onChange={setPreference} />;
}

function WiredSwitch(): JSX.Element {
  const { preference, setPreference } = useColorMode();
  return <ColorModeSwitch preference={preference} onChange={setPreference} />;
}

describe('ColorModeSwitch (ADR-0012)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute('data-color-mode', 'light');
  });

  it('cycles Sáng → Tối → Theo hệ thống → Sáng with an accessible name', () => {
    render(<ControlledSwitch />);

    fireEvent.click(screen.getByRole('button', { name: 'Giao diện: Sáng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giao diện: Tối' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giao diện: Theo hệ thống' }));

    expect(screen.getByRole('button', { name: 'Giao diện: Sáng' })).toBeInTheDocument();
  });

  it('applies and persists the chosen mode on <html>', () => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light');
    render(<WiredSwitch />);

    fireEvent.click(screen.getByRole('button', { name: 'Giao diện: Sáng' }));

    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
  });
});
