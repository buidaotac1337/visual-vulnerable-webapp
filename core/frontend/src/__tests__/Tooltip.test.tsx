import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModeSwitch, Tooltip, TopControlBar } from '@/components';
import { modeTip, testMyFixTip, UI_LABELS } from '@/lib';
import type { LabMetadata } from '@/types';

const LAB_WITH_FRONTEND_SINK: LabMetadata = {
  id: '02-stored-xss',
  title: 'Stored XSS',
  category: 'XSS',
  difficulty: 'Cơ bản',
  summary: 'Stored XSS demo.',
  safetyPattern: 'Render text instead of raw HTML.',
  samplePayloads: [],
  verifyTests: [
    {
      layer: 'frontend',
      name: 'Blocks script',
      component: 'ReviewBody',
      props: { content: '<img src=x onerror=1>' },
      expect: { no_onerror: true },
    },
  ],
  actors: ['alice'],
};

describe('Tooltip', () => {
  it('opens on hover or focus, closes on blur or Escape, and stops Escape propagation', () => {
    const parentKeyDown = vi.fn();
    render(
      <div onKeyDown={parentKeyDown}>
        <Tooltip tip="Khôi phục database.">
          <button type="button">Reset DB</button>
        </Tooltip>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Reset DB' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(button).toHaveAccessibleDescription('Khôi phục database.');
    expect(tip).toHaveClass('hidden');

    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');
    fireEvent.blur(button);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');

    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('stays open when moving the pointer onto the tooltip (WCAG 1.4.13)', () => {
    render(
      <Tooltip tip="Phát lại trace.">
        <button type="button">Replay</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Replay' });
    const wrapper = button.parentElement as HTMLElement;
    const tip = screen.getByRole('tooltip', { hidden: true });
    const positioned = tip.parentElement as HTMLElement;

    expect(tip).not.toHaveClass('pointer-events-none');
    expect(positioned).toHaveClass('top-full', 'pt-1.5');

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(tip);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');
  });

  it('preserves an existing aria-describedby on the trigger', () => {
    render(
      <div>
        <span id="existing-hint">Gợi ý sẵn</span>
        <Tooltip tip="Giải thích thêm.">
          <button type="button" aria-describedby="existing-hint">
            Kiểm tra
          </button>
        </Tooltip>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Kiểm tra' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(button.getAttribute('aria-describedby')).toBe(`existing-hint ${tip.id}`);
    expect(button).toHaveAccessibleDescription('Gợi ý sẵn Giải thích thêm.');
  });

  it('supports side="top" and align="start" / "end" placement classes', () => {
    const { rerender } = render(
      <Tooltip tip="Bên trái" side="top" align="start">
        <button type="button">Trước</button>
      </Tooltip>,
    );
    let positioned = screen.getByRole('tooltip', { hidden: true }).parentElement as HTMLElement;
    expect(positioned).toHaveClass('bottom-full', 'pb-1.5', 'left-0');

    rerender(
      <Tooltip tip="Bên phải" side="bottom" align="end">
        <button type="button">Tải</button>
      </Tooltip>,
    );
    positioned = screen.getByRole('tooltip', { hidden: true }).parentElement as HTMLElement;
    expect(positioned).toHaveClass('top-full', 'pt-1.5', 'right-0');
  });

  it('closes when its trigger transitions to disabled', () => {
    const { rerender } = render(
      <Tooltip tip="Lùi bước.">
        <button type="button">Trước</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Trước' });
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden');

    rerender(
      <Tooltip tip="Lùi bước.">
        <button type="button" disabled>
          Trước
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveClass('hidden');
  });

  it('builds UI_LABELS tips for backend-only and frontend-sink labs', () => {
    expect(modeTip('vulnerable', false)).toBe(UI_LABELS.vulnerable.tip);
    expect(modeTip('secure', false)).toBe(UI_LABELS.secure.tip);
    expect(modeTip('vulnerable', true)).toContain('frontend/vulnerable.tsx');
    expect(modeTip('secure', true)).toContain('frontend/secure.tsx');
    expect(testMyFixTip(false)).toBe(UI_LABELS.testMyFix.tip);
    expect(testMyFixTip(true)).toContain('frontend/vulnerable.tsx');

    render(<ModeSwitch mode="vulnerable" onChange={() => undefined} />);
    const secure = screen.getByRole('radio', { name: UI_LABELS.secure.text });
    expect(secure).toHaveAccessibleDescription(UI_LABELS.secure.tip);
  });

  it('passes frontend-sink tips through TopControlBar to ModeSwitch and Test My Fix', () => {
    render(
      <TopControlBar
        health={null}
        apiError={null}
        labs={[LAB_WITH_FRONTEND_SINK]}
        selectedLab={LAB_WITH_FRONTEND_SINK}
        mode="vulnerable"
        isResettingDb={false}
        isVerifying={false}
        isDownloading={false}
        onSelectLab={() => undefined}
        onChangeMode={() => undefined}
        onResetDb={() => undefined}
        onVerify={() => undefined}
        onDownloadSnippet={() => undefined}
      />,
    );
    expect(
      screen.getByRole('radio', { name: UI_LABELS.vulnerable.text }),
    ).toHaveAccessibleDescription(modeTip('vulnerable', true));
    expect(screen.getByRole('radio', { name: UI_LABELS.secure.text })).toHaveAccessibleDescription(
      modeTip('secure', true),
    );
    expect(
      screen.getByRole('button', { name: UI_LABELS.testMyFix.text }),
    ).toHaveAccessibleDescription(testMyFixTip(true));
  });
});
