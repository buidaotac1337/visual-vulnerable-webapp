import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { LabWorkspace, LayoutModeSwitch, SplitDivider } from '@/components';
import { useWorkspaceLayout } from '@/hooks';
import { UI_LABELS } from '@/lib';
import type {
  HealthResponse,
  LabListResponse,
  LabSourceResponse,
  WorkspaceLayoutMode,
} from '@/types';

const HEALTH: HealthResponse = {
  status: 'ok',
  service: 'VVWA',
  version: '0.1.0',
  environment: 'test',
};
const LABS: LabListResponse = {
  labs: [
    {
      id: '99-layout-demo',
      title: 'Lab 99 Layout Demo',
      category: 'Injection',
      difficulty: 'Cơ bản',
      summary: 'Demo.',
      safetyPattern: 'Use $1.',
      samplePayloads: [],
      verifyTests: [{ name: 'T', action: 'login', input: {}, expect: {} }],
    },
  ],
};
const SOURCE: LabSourceResponse = {
  lab_id: '99-layout-demo',
  vulnerable: { code: 'def login():\n    return True', steps: {}, line_count: 2 },
  secure: { code: 'def login():\n    return False', steps: {}, line_count: 2 },
  frontend: null,
  diff: '--- a\n+++ b\n@@ -1 +1 @@\n-True\n+False',
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function dispatchPointerMove(clientX: number): void {
  fireEvent(window, new MouseEvent('pointermove', { clientX, bubbles: true }));
}

function StatefulSandboxChild(): JSX.Element {
  const [draft, setDraft] = useState('initial-draft');
  return (
    <input
      aria-label="Sandbox draft input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

function WorkspaceHarness(): JSX.Element {
  const layout = useWorkspaceLayout();
  return (
    <div>
      <LayoutModeSwitch mode={layout.layoutMode} onChange={layout.setLayoutMode} />
      <LabWorkspace
        mode="vulnerable"
        notice={null}
        layoutMode={layout.layoutMode}
        splitPercent={layout.splitPercent}
        isFloatingCollapsed={layout.isFloatingCollapsed}
        onChangeSplit={layout.setSplitPercent}
        onResetSplit={layout.resetSplit}
        onToggleFloatingCollapsed={layout.toggleFloatingCollapsed}
        onChangeLayoutMode={layout.setLayoutMode}
        leftPane={<StatefulSandboxChild />}
        rightPane={<div>Inspector Content</div>}
      />
    </div>
  );
}

describe('useWorkspaceLayout', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults, clamps splitPercent to 30..70, and resets collapsed state on floating', () => {
    const { result } = renderHook(() => useWorkspaceLayout());
    expect(result.current.layoutMode).toBe('split');
    expect(result.current.splitPercent).toBe(50);
    expect(result.current.isFloatingCollapsed).toBe(false);

    act(() => result.current.setSplitPercent(15));
    expect(result.current.splitPercent).toBe(30);
    expect(window.localStorage.getItem('vvwa.splitPercent')).toBe('30');

    act(() => result.current.setSplitPercent(92));
    expect(result.current.splitPercent).toBe(70);
    act(() => result.current.resetSplit());
    expect(result.current.splitPercent).toBe(50);

    act(() => result.current.setLayoutMode('floating'));
    act(() => result.current.toggleFloatingCollapsed());
    expect(result.current.isFloatingCollapsed).toBe(true);

    act(() => result.current.setLayoutMode('code-focus'));
    expect(window.localStorage.getItem('vvwa.layoutMode')).toBe('code-focus');
    act(() => result.current.setLayoutMode('floating'));
    expect(result.current.isFloatingCollapsed).toBe(false);
  });

  it('validates stored values and falls back cleanly when localStorage throws', () => {
    window.localStorage.setItem('vvwa.layoutMode', 'invalid-mode');
    window.localStorage.setItem('vvwa.splitPercent', 'not-a-number');
    const first = renderHook(() => useWorkspaceLayout());
    expect(first.result.current.layoutMode).toBe('split');
    expect(first.result.current.splitPercent).toBe(50);

    window.localStorage.setItem('vvwa.layoutMode', 'floating');
    window.localStorage.setItem('vvwa.splitPercent', '85');
    const second = renderHook(() => useWorkspaceLayout());
    expect(second.result.current.layoutMode).toBe('floating');
    expect(second.result.current.splitPercent).toBe(70);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const fallback = renderHook(() => useWorkspaceLayout());
    expect(fallback.result.current.layoutMode).toBe('split');
    expect(fallback.result.current.splitPercent).toBe(50);
    act(() => fallback.result.current.setLayoutMode('code-focus'));
    expect(fallback.result.current.layoutMode).toBe('code-focus');
  });
});

describe('LayoutModeSwitch & SplitDivider', () => {
  it('exposes radiogroup ARIA attributes, tooltips, and arrow/Home/End keyboard nav', () => {
    const onChange = vi.fn<(next: WorkspaceLayoutMode) => void>();
    render(<LayoutModeSwitch mode="split" onChange={onChange} />);

    const group = screen.getByRole('radiogroup', { name: 'Bố cục workspace' });
    expect(group).toHaveClass('hidden', 'lg:inline-flex');

    const splitBtn = screen.getByRole('radio', { name: UI_LABELS.layoutSplit.text });
    const focusBtn = screen.getByRole('radio', { name: UI_LABELS.layoutCodeFocus.text });
    const floatBtn = screen.getByRole('radio', { name: UI_LABELS.layoutFloating.text });
    expect(splitBtn).toHaveAttribute('aria-checked', 'true');
    expect(focusBtn).toHaveAccessibleDescription(UI_LABELS.layoutCodeFocus.tip);

    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('code-focus');
    expect(focusBtn).toHaveFocus();

    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('floating');
    expect(floatBtn).toHaveFocus();

    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('split');
    expect(splitBtn).toHaveFocus();
  });

  it('supports keyboard arrows, Home/End, double-click reset, and pointer drag clamping', () => {
    const onChangeSplit = vi.fn();
    const onResetSplit = vi.fn();
    const container = document.createElement('main');
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 1000,
    } as DOMRect);

    render(
      <SplitDivider
        splitPercent={50}
        containerRef={{ current: container }}
        onChangeSplit={onChangeSplit}
        onResetSplit={onResetSplit}
      />,
    );

    const sep = screen.getByRole('separator', { name: 'Điều chỉnh tỷ lệ chiều rộng hai cột' });
    expect(sep).toHaveAttribute('aria-valuenow', '50');
    expect(sep).toHaveAttribute('aria-valuemin', '30');
    expect(sep).toHaveAttribute('aria-valuemax', '70');

    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(onChangeSplit).toHaveBeenLastCalledWith(45);
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(onChangeSplit).toHaveBeenLastCalledWith(55);
    fireEvent.keyDown(sep, { key: 'Home' });
    fireEvent.keyDown(sep, { key: 'End' });
    fireEvent.doubleClick(sep);
    expect(onResetSplit).toHaveBeenCalledTimes(3);

    fireEvent.pointerDown(sep, { pointerId: 1, clientX: 500 });
    dispatchPointerMove(380);
    expect(onChangeSplit).toHaveBeenLastCalledWith(38);
    dispatchPointerMove(120);
    expect(onChangeSplit).toHaveBeenLastCalledWith(30);
    dispatchPointerMove(950);
    expect(onChangeSplit).toHaveBeenLastCalledWith(70);
    fireEvent.pointerUp(window);
  });
});

describe('Workspace layout modes integration', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('switches all 3 modes, toggles floating collapse, and preserves child state', () => {
    render(<WorkspaceHarness />);
    const input = screen.getByLabelText('Sandbox draft input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'custom-payload-state' } });
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: UI_LABELS.layoutCodeFocus.text }));
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.getByLabelText('MiniShop Sandbox')).toHaveClass('lg:hidden');
    expect(screen.getByLabelText('Sandbox draft input')).toBe(input);
    expect(input.value).toBe('custom-payload-state');

    fireEvent.click(screen.getByRole('button', { name: UI_LABELS.layoutRestoreSplit.text }));
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: UI_LABELS.layoutFloating.text }));
    expect(screen.getByLabelText('MiniShop Sandbox')).toHaveClass('lg:top-14', 'lg:right-4');
    const collapseBtn = screen.getByRole('button', { name: 'Thu gọn' });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapseBtn);

    const expandBtn = screen.getByRole('button', { name: 'Mở rộng' });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    expect(input.parentElement).toHaveClass('lg:hidden');
    fireEvent.click(expandBtn);
    expect(input.parentElement).not.toHaveClass('lg:hidden');
    expect(input.value).toBe('custom-payload-state');

    fireEvent.click(screen.getByRole('button', { name: UI_LABELS.layoutRestoreSplit.text }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('wires TopControlBar LayoutModeSwitch to LabWorkspace in App without losing LabView input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/health') return okJson(HEALTH);
        if (url === '/api/labs') return okJson(LABS);
        if (url === '/api/labs/99-layout-demo/source') return okJson(SOURCE);
        return okJson({});
      }),
    );

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lab 99 Layout Demo' })).toBeInTheDocument();

    const payloadBox = screen.getByLabelText('JSON Payload') as HTMLTextAreaElement;
    fireEvent.change(payloadBox, { target: { value: '{"username":"bob"}' } });

    fireEvent.click(screen.getByRole('radio', { name: UI_LABELS.layoutCodeFocus.text }));
    expect(window.localStorage.getItem('vvwa.layoutMode')).toBe('code-focus');
    expect((screen.getByLabelText('JSON Payload') as HTMLTextAreaElement).value).toBe(
      '{"username":"bob"}',
    );

    fireEvent.click(screen.getByRole('radio', { name: UI_LABELS.layoutFloating.text }));
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
