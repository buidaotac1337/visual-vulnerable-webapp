import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TraceControls, TraceSpeedSwitch, TraceStepPills } from '@/components';
import { useTraceShortcuts } from '@/hooks';
import { UI_LABELS } from '@/lib';
import type { TracePlaybackSpeed, TraceStep } from '@/types';

const STEPS: TraceStep[] = [
  { step: 1, layer: 'frontend', tag: 'fe', status: 'info', title: 'Gửi form', detail: 'd1' },
  { step: 2, layer: 'backend', tag: 'be', status: 'warning', title: 'Nhận payload', detail: 'd2' },
  { step: 3, layer: 'database', tag: 'db', status: 'danger', title: 'Lỗi SQLi', detail: 'd3' },
];

function ShortcutHarness({
  enabled = true,
  hasTrace = true,
  onPrev,
  onNext,
  onTogglePlayPause,
}: {
  enabled?: boolean;
  hasTrace?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlayPause: () => void;
}): JSX.Element {
  useTraceShortcuts({ enabled, hasTrace, onPrev, onNext, onTogglePlayPause });
  return (
    <div>
      <input aria-label="Text input" />
      <textarea aria-label="Text area" />
      <select aria-label="Lab select">
        <option value="a">A</option>
      </select>
      <div contentEditable="true" aria-label="Editable box" />
      <button type="button">Plain button</button>
      <a href="#sec">Anchor link</a>
      <div role="radiogroup" aria-label="Radio box">
        <button type="button" role="radio" aria-checked="true">
          Opt 1
        </button>
      </div>
      <div role="tablist" aria-label="Tabs box">
        <button type="button" role="tab" aria-selected="true">
          Tab 1
        </button>
      </div>
      <div role="separator" tabIndex={0} aria-label="Divider" />
    </div>
  );
}

describe('TraceControls progressbar & Play/Pause/Replay states', () => {
  it('updates progressbar aria values and toggles Phát / Dừng / Phát lại cleanly', () => {
    const onTogglePlayPause = vi.fn();
    const base = {
      safetyPattern: 'Use $1.',
      steps: STEPS,
      speed: '1x' as TracePlaybackSpeed,
      onPrev: vi.fn(),
      onReplay: vi.fn(),
      onTogglePlayPause,
      onNext: vi.fn(),
      onChangeSpeed: vi.fn(),
      onJumpToStep: vi.fn(),
    };

    const { rerender } = render(
      <TraceControls {...base} totalSteps={0} activeIndex={-1} status="idle" steps={[]} />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Tiến độ phát trace' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByRole('button', { name: UI_LABELS.playTrace.text })).toBeDisabled();

    rerender(<TraceControls {...base} totalSteps={3} activeIndex={1} status="playing" />);
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    const pauseBtn = screen.getByRole('button', { name: UI_LABELS.pauseTrace.text });
    expect(pauseBtn).toHaveAccessibleDescription(UI_LABELS.pauseTrace.tip);
    fireEvent.click(pauseBtn);
    expect(onTogglePlayPause).toHaveBeenCalledTimes(1);

    rerender(<TraceControls {...base} totalSteps={3} activeIndex={1} status="paused" />);
    const playBtn = screen.getByRole('button', { name: UI_LABELS.playTrace.text });
    expect(playBtn).toHaveAccessibleDescription(UI_LABELS.playTrace.tip);

    rerender(<TraceControls {...base} totalSteps={3} activeIndex={2} status="completed" />);
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    const replayBtn = screen.getByRole('button', { name: UI_LABELS.replayTrace.text });
    expect(replayBtn).toHaveAccessibleDescription(UI_LABELS.replayTrace.tip);
  });
});

function ControlledSpeedSwitch({
  onChange,
}: {
  onChange: (speed: TracePlaybackSpeed) => void;
}): JSX.Element {
  const [speed, setSpeed] = useState<TracePlaybackSpeed>('1x');
  return (
    <TraceSpeedSwitch
      speed={speed}
      onChange={(next) => {
        setSpeed(next);
        onChange(next);
      }}
    />
  );
}

describe('TraceSpeedSwitch & TraceStepPills', () => {
  it('exposes radiogroup ARIA, tooltips, and arrow/Home/End keyboard navigation', () => {
    const onChange = vi.fn<(speed: TracePlaybackSpeed) => void>();
    render(<ControlledSpeedSwitch onChange={onChange} />);

    const group = screen.getByRole('radiogroup', { name: 'Tốc độ phát trace' });
    const manual = screen.getByRole('radio', { name: UI_LABELS.speedManual.text });
    const normal = screen.getByRole('radio', { name: UI_LABELS.speedNormal.text });
    const fast = screen.getByRole('radio', { name: UI_LABELS.speedDouble.text });

    expect(normal).toHaveAttribute('aria-checked', 'true');
    expect(manual).toHaveAccessibleDescription(UI_LABELS.speedManual.tip);
    expect(fast).toHaveAccessibleDescription(UI_LABELS.speedDouble.tip);
    const manualTip = document.getElementById(manual.getAttribute('aria-describedby') ?? '');
    expect(manualTip?.parentElement).toHaveClass('bottom-full', 'pb-1.5', 'right-0');

    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('2x');
    expect(fast).toHaveAttribute('aria-checked', 'true');
    expect(fast).toHaveFocus();

    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('manual');
    expect(manual).toHaveAttribute('aria-checked', 'true');
    expect(manual).toHaveFocus();

    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('2x');
    expect(fast).toHaveFocus();

    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('1x');
    expect(normal).toHaveAttribute('aria-checked', 'true');
    expect(normal).toHaveFocus();
  });

  it('renders step pills with aria-current, tooltips, and jumps on click', () => {
    const onJumpToStep = vi.fn();
    render(<TraceStepPills steps={STEPS} activeIndex={1} onJumpToStep={onJumpToStep} />);

    const step2 = screen.getByRole('button', { name: 'Bước 2: Nhận payload' });
    const step3 = screen.getByRole('button', { name: 'Bước 3: Lỗi SQLi' });
    expect(step2).toHaveAttribute('aria-current', 'step');
    expect(step3).not.toHaveAttribute('aria-current');
    expect(step3).toHaveAccessibleDescription('Lỗi SQLi');
    const step2TipBox = document.getElementById(
      step2.getAttribute('aria-describedby') ?? '',
    )?.parentElement;
    const step3TipBox = document.getElementById(
      step3.getAttribute('aria-describedby') ?? '',
    )?.parentElement;
    expect(step2TipBox).toHaveClass('top-full', 'pt-1.5', 'right-0');
    expect(step3TipBox).toHaveClass('top-full', 'pt-1.5', 'right-0');

    fireEvent.click(step3);
    expect(onJumpToStep).toHaveBeenCalledWith(2);
  });
});

describe('useTraceShortcuts', () => {
  it('handles arrows and Space on body while ignoring form controls, ARIA widgets, and disabled states', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onTogglePlayPause = vi.fn();
    const { rerender } = render(
      <ShortcutHarness onPrev={onPrev} onNext={onNext} onTogglePlayPause={onTogglePlayPause} />,
    );

    const arrowLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(arrowLeft);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(arrowLeft.defaultPrevented).toBe(true);

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);

    const spaceBody = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.body.dispatchEvent(spaceBody);
    expect(onTogglePlayPause).toHaveBeenCalledTimes(1);
    expect(spaceBody.defaultPrevented).toBe(true);

    fireEvent.keyDown(document.body, { key: ' ', ctrlKey: true });
    expect(onTogglePlayPause).toHaveBeenCalledTimes(1);

    for (const el of [
      screen.getByLabelText('Text input'),
      screen.getByLabelText('Text area'),
      screen.getByLabelText('Lab select'),
      screen.getByLabelText('Editable box'),
    ]) {
      fireEvent.keyDown(el, { key: 'ArrowLeft' });
      fireEvent.keyDown(el, { key: ' ' });
    }
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onTogglePlayPause).toHaveBeenCalledTimes(1);

    for (const widget of [
      screen.getByRole('radio', { name: 'Opt 1' }),
      screen.getByRole('tab', { name: 'Tab 1' }),
      screen.getByRole('separator', { name: 'Divider' }),
    ]) {
      fireEvent.keyDown(widget, { key: 'ArrowRight' });
      fireEvent.keyDown(widget, { key: ' ' });
    }
    fireEvent.keyDown(screen.getByRole('button', { name: 'Plain button' }), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('link', { name: 'Anchor link' }), { key: ' ' });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onTogglePlayPause).toHaveBeenCalledTimes(1);

    rerender(
      <ShortcutHarness
        enabled={false}
        onPrev={onPrev}
        onNext={onNext}
        onTogglePlayPause={onTogglePlayPause}
      />,
    );
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
