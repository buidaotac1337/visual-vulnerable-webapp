import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OutcomeCoachPanel, PayloadChipBar, VerifyModal } from '@/components';
import { classifySamplePayload, deriveOutcomeCoaching } from '@/lib';
import type { LabExecutionResponse, SamplePayload, VerifyLabResponse } from '@/types';

function makeResponse(outcome: LabExecutionResponse['meta']['outcome']): LabExecutionResponse {
  return {
    ok: outcome !== 'error',
    data: { status: outcome, count: 1 },
    meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome },
    trace: [],
  };
}

function makeVerifyResult(passed: boolean): VerifyLabResponse {
  return {
    ok: true,
    lab_id: '01-sql-injection',
    passed,
    total: 2,
    passed_count: passed ? 2 : 1,
    results: [
      {
        name: 'Chặn payload tấn công',
        action: 'login',
        passed,
        expected: { logged_in: false },
        actual: { logged_in: !passed },
        error: null,
      },
    ],
  };
}

describe('deriveOutcomeCoaching', () => {
  it('covers all mode and outcome combinations', () => {
    const vulnExploit = deriveOutcomeCoaching('vulnerable', 'exploited', false);
    expect(vulnExploit.tone).toBe('danger');
    expect(vulnExploit.ctaKind).toBe('switch-to-secure');

    const vulnExploitFe = deriveOutcomeCoaching('vulnerable', 'exploited', true);
    expect(vulnExploitFe.explanation).toContain('vulnerable.tsx');

    const vulnBlocked = deriveOutcomeCoaching('vulnerable', 'blocked', false);
    expect(vulnBlocked.tone).toBe('safe');
    expect(vulnBlocked.ctaKind).toBe('open-verify');

    const vulnNormal = deriveOutcomeCoaching('vulnerable', 'normal', false);
    expect(vulnNormal.tone).toBe('info');
    expect(vulnNormal.ctaKind).toBeNull();

    const secBlocked = deriveOutcomeCoaching('secure', 'blocked', false);
    expect(secBlocked.tone).toBe('safe');
    expect(secBlocked.ctaKind).toBe('open-diff');

    const secNormal = deriveOutcomeCoaching('secure', 'normal', false);
    expect(secNormal.tone).toBe('info');
    expect(secNormal.ctaKind).toBe('open-diff');

    const secExploit = deriveOutcomeCoaching('secure', 'exploited', false);
    expect(secExploit.tone).toBe('warning');
    expect(secExploit.ctaKind).toBe('open-diff');

    const err = deriveOutcomeCoaching('vulnerable', 'error', false);
    expect(err.tone).toBe('warning');
    expect(err.ctaKind).toBeNull();
    expect(err.explanation).toContain('runtime-error');
  });
});

describe('classifySamplePayload', () => {
  it('accurately separates attack payloads from normal flows across labs', () => {
    const cases: Array<{ sample: SamplePayload; expected: 'attack' | 'normal' }> = [
      {
        sample: {
          label: 'Bypass Admin Login',
          description: 'Biến WHERE thành luôn đúng',
          data: {},
        },
        expected: 'attack',
      },
      {
        sample: {
          label: 'Đăng nhập thường (alice)',
          description: 'Kiểm tra luồng đăng nhập hợp lệ với tài khoản alice.',
          data: {},
        },
        expected: 'normal',
      },
      {
        sample: {
          label: 'Alice xem trang sản phẩm',
          description: 'Nạn nhân mở trang sản phẩm và tải danh sách đánh giá.',
          data: {},
        },
        expected: 'normal',
      },
      {
        sample: {
          label: 'Bob mua vượt số dư',
          description: 'Luồng bị từ chối hợp lệ: 3 tai nghe $360 trong khi bob có $250.',
          data: {},
        },
        expected: 'normal',
      },
      {
        sample: {
          label: 'Email sai định dạng',
          description: 'Schema cũng là nơi kiểm tra định dạng dữ liệu được phép sửa.',
          data: {},
        },
        expected: 'normal',
      },
      {
        sample: {
          label: 'Mã giảm giá không tồn tại',
          description: 'Luồng từ chối hợp lệ khi bob gửi mã FAKE99.',
          data: {},
        },
        expected: 'normal',
      },
      {
        sample: {
          label: 'Traversal kèm ảnh thật (../evil.png)',
          description: 'Kể cả khi magic bytes là PNG thật, tên file vẫn thoát khỏi uploads/.',
          data: {},
        },
        expected: 'attack',
      },
      {
        sample: {
          label: 'Vượt allowlist bằng 302 Redirect',
          description: 'Gửi URL trên CDN hợp lệ nhưng server CDN trả 302 Redirect sang metadata.',
          data: {},
        },
        expected: 'attack',
      },
      {
        sample: {
          label: 'Ảnh CDN hợp lệ (kb.png)',
          description: 'Luồng bình thường: tải ảnh PNG hợp lệ từ minishop-cdn:8090.',
          data: {},
        },
        expected: 'normal',
      },
    ];

    for (const item of cases) {
      expect(classifySamplePayload(item.sample)).toBe(item.expected);
    }
  });
});

describe('OutcomeCoachPanel', () => {
  it('renders coaching explanation, invokes CTA, and toggles JSON details', () => {
    const onSwitchMode = vi.fn();
    render(
      <OutcomeCoachPanel
        mode="vulnerable"
        response={makeResponse('exploited')}
        onSwitchMode={onSwitchMode}
      />,
    );

    expect(screen.getByText('Phản hồi từ hệ thống')).toBeInTheDocument();
    expect(screen.getByText('BỊ KHAI THÁC (EXPLOITED)')).toBeInTheDocument();
    expect(screen.getByText(/"status": "exploited"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gạt sang Secure để so sánh' }));
    expect(onSwitchMode).toHaveBeenCalledWith('secure');

    const toggleBtn = screen.getByRole('button', { name: 'Chi tiết dữ liệu JSON' });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/"status": "exploited"/)).toBeNull();
  });
});

describe('PayloadChipBar', () => {
  it('preserves accessible button names and shows beginner submit hint after selection', () => {
    const onSelect = vi.fn();
    const payloads: SamplePayload[] = [
      { label: 'Bypass Admin', description: 'Tiêm OR 1=1--', data: {} },
      { label: 'Xem đơn của mình', description: 'Luồng hợp lệ.', actor: 'alice', data: {} },
    ];
    render(<PayloadChipBar payloads={payloads} onSelect={onSelect} />);

    expect(screen.getByText('Thử tấn công')).toBeInTheDocument();
    expect(screen.getByText('Luồng hợp lệ')).toBeInTheDocument();

    const attackBtn = screen.getByRole('button', { name: 'Bypass Admin' });
    const normalBtn = screen.getByRole('button', { name: 'Xem đơn của mình vai alice' });
    expect(attackBtn).toBeInTheDocument();
    expect(normalBtn).toBeInTheDocument();

    fireEvent.click(attackBtn);
    expect(onSelect).toHaveBeenCalledWith(payloads[0]);
    expect(screen.getByText('Tiêm OR 1=1--')).toBeInTheDocument();
    expect(
      screen.getByText('Đã điền vào biểu mẫu — hãy bấm nút gửi ở trên để xem kết quả.'),
    ).toBeInTheDocument();
  });
});

describe('VerifyModal beginner guidance', () => {
  it('shows file path hint, copy button, Diff hint on fail, and Next Lab on pass', () => {
    const onOpenDiff = vi.fn();
    const onNextLab = vi.fn();
    const onClose = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const baseProps = {
      isOpen: true,
      labTitle: 'SQL Injection',
      labId: '01-sql-injection',
      mode: 'vulnerable' as const,
      isLoading: false,
      error: null,
      onRerun: vi.fn(),
      onClose,
      onOpenDiff,
      onNextLab,
      nextLabTitle: 'Stored XSS',
    };

    const { rerender } = render(<VerifyModal {...baseProps} result={makeVerifyResult(false)} />);

    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText('labs/01-sql-injection/backend/vulnerable.py')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép đường dẫn' }));
    expect(writeText).toHaveBeenCalledWith('labs/01-sql-injection/backend/vulnerable.py');
    expect(screen.getByRole('button', { name: 'Đã sao chép' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý ở tab Diff' }));
    expect(onOpenDiff).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<VerifyModal {...baseProps} mode="secure" result={makeVerifyResult(true)} />);
    expect(screen.getAllByRole('note')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Học tiếp: Stored XSS' }));
    expect(onNextLab).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
