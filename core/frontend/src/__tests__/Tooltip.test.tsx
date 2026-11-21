import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ModeSwitch, Tooltip } from '@/components';
import { UI_LABELS } from '@/lib';

describe('Tooltip', () => {
  it('describes its trigger and opens on hover or focus, closing on Escape', () => {
    render(
      <Tooltip tip="Khôi phục database.">
        <button type="button">Reset DB</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Reset DB' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(button).toHaveAccessibleDescription('Khôi phục database.');
    expect(tip).toHaveClass('hidden');

    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');

    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');
    fireEvent.mouseLeave(button.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');
  });

  it('gives workspace controls their label and tip from UI_LABELS', () => {
    render(<ModeSwitch mode="vulnerable" onChange={() => undefined} />);
    const secure = screen.getByRole('radio', { name: UI_LABELS.secure.text });
    expect(secure).toHaveAccessibleDescription(UI_LABELS.secure.tip);
  });
});
