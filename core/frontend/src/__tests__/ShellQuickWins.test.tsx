import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodeInspector, PayloadChipBar, VerifyModal } from '@/components';
import type { LabSourceResponse, TraceStep } from '@/types';

const SOURCE: LabSourceResponse = {
  lab_id: '90-demo',
  vulnerable: { code: 'def run():\n    return 1', steps: { 'be-run': 1 }, line_count: 2 },
  secure: { code: 'def run():\n    return 1', steps: { 'be-run': 1 }, line_count: 2 },
  frontend: { code: 'const send = () => {};', steps: { 'fe-send': 1 }, line_count: 1 },
  diff: '',
};

function step(n: number, layer: TraceStep['layer'], tag: string): TraceStep {
  return { step: n, layer, tag, status: 'info', title: `Bước ${String(n)}`, detail: '' };
}

describe('Test My Fix target', () => {
  it('says vulnerable.py is graded, and warns about it in Secure mode', () => {
    const props = {
      isOpen: true,
      labTitle: 'Demo',
      isLoading: true,
      result: null,
      error: null,
      onRerun: vi.fn(),
      onClose: vi.fn(),
    };
    const { rerender } = render(<VerifyModal {...props} mode="vulnerable" />);
    expect(screen.getByText(/Chấm bài làm của bạn trong/)).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();

    rerender(<VerifyModal {...props} mode="secure" />);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Bạn đang xem chế độ Secure, nhưng Test My Fix luôn chấm vulnerable.py',
    );
  });
});

describe('Payload chips', () => {
  it('shows the picked chip description as visible text', () => {
    const onSelect = vi.fn();
    const payloads = [
      { label: 'Bypass', description: 'Biến WHERE thành luôn đúng.', data: {} },
      { label: 'Thường', description: 'Đăng nhập hợp lệ.', data: {} },
    ];
    render(<PayloadChipBar payloads={payloads} onSelect={onSelect} />);
    expect(screen.queryByText('Biến WHERE thành luôn đúng.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bypass' }));
    expect(onSelect).toHaveBeenCalledWith(payloads[0]);
    expect(screen.getByText('Biến WHERE thành luôn đúng.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bypass' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Inspector tab follows the trace', () => {
  it('says when it switches tab for a step, and clears the note on a manual pick', () => {
    const onChangeTab = vi.fn();
    const base = {
      lab: null,
      mode: 'vulnerable' as const,
      source: SOURCE,
      sourceError: null,
      isRefreshing: false,
      totalSteps: 2,
      playbackStatus: 'paused' as const,
      onChangeTab,
      onRefreshSource: vi.fn(),
      onPrevStep: vi.fn(),
      onReplayTrace: vi.fn(),
      onNextStep: vi.fn(),
    };
    render(
      <CodeInspector
        {...base}
        activeTab="backend"
        activeIndex={0}
        activeStep={step(1, 'frontend', 'fe-send')}
      />,
    );
    expect(onChangeTab).toHaveBeenCalledWith('frontend');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Bước 1 nằm ở tab Frontend: đã chuyển tab.',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Diff' }));
    expect(onChangeTab).toHaveBeenLastCalledWith('diff');
    expect(screen.queryByText(/đã chuyển tab/)).toBeNull();
  });
});
