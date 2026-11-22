import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LabCatalogModal, LabStepperCard, WelcomeBanner } from '@/components';
import { useLearningProgress } from '@/hooks';
import type { LabStepProgress } from '@/hooks';
import type { LabMetadata } from '@/types';

const SAMPLE_LABS: readonly LabMetadata[] = [
  {
    id: '01-sql-injection',
    title: 'SQL Injection',
    category: 'Injection',
    difficulty: 'Cơ bản',
    summary: 'Khai thác ghép chuỗi SQL và sửa bằng parameterized query.',
    safetyPattern: 'Parameterized query',
    samplePayloads: [],
    verifyTests: [],
  },
  {
    id: '02-stored-xss',
    title: 'Stored XSS',
    category: 'XSS',
    difficulty: 'Cơ bản',
    summary: 'Chèn script vào đánh giá sản phẩm và vá bằng JSX escaping.',
    safetyPattern: 'React auto-escaping',
    samplePayloads: [],
    verifyTests: [],
  },
  {
    id: '07-file-upload',
    title: 'Unrestricted File Upload',
    category: 'File Security',
    difficulty: 'Trung bình',
    summary: 'Tải tệp nguy hiểm lên server và kiểm tra định dạng an toàn.',
    safetyPattern: 'MIME & extension allowlist',
    samplePayloads: [],
    verifyTests: [],
  },
];

const EMPTY_PROGRESS: LabStepProgress = {
  exploredVulnerable: false,
  comparedSecure: false,
  viewedDiff: false,
  passedVerify: false,
};

describe('useLearningProgress', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('persists step progress, counts passed labs, and handles onboarding + reset', () => {
    const { result } = renderHook(() => useLearningProgress());
    expect(result.current.onboardingDismissed).toBe(false);
    expect(result.current.getCompletedStepCount('01-sql-injection')).toBe(0);

    act(() => result.current.markExploredVulnerable('01-sql-injection'));
    act(() => result.current.markComparedSecure('01-sql-injection'));
    act(() => result.current.markViewedDiff('01-sql-injection'));
    act(() => result.current.markPassedVerify('01-sql-injection'));

    expect(result.current.getCompletedStepCount('01-sql-injection')).toBe(4);
    expect(result.current.countPassedLabs(SAMPLE_LABS)).toBe(1);

    const reloaded = renderHook(() => useLearningProgress());
    expect(reloaded.result.current.getLabProgress('01-sql-injection')).toEqual({
      exploredVulnerable: true,
      comparedSecure: true,
      viewedDiff: true,
      passedVerify: true,
    });

    act(() => reloaded.result.current.dismissOnboarding());
    expect(reloaded.result.current.onboardingDismissed).toBe(true);
    expect(window.localStorage.getItem('vvwa.onboardingDismissed')).toBe('true');

    act(() => reloaded.result.current.reopenOnboarding());
    expect(reloaded.result.current.onboardingDismissed).toBe(false);

    act(() => reloaded.result.current.resetProgress());
    expect(reloaded.result.current.getCompletedStepCount('01-sql-injection')).toBe(0);
    expect(reloaded.result.current.countPassedLabs(SAMPLE_LABS)).toBe(0);
  });

  it('falls back cleanly when localStorage contains corrupted JSON', () => {
    window.localStorage.setItem('vvwa.learningProgress', '{not-valid-json');
    const { result } = renderHook(() => useLearningProgress());
    expect(result.current.progressByLab).toEqual({});
    expect(result.current.getLabProgress('01-sql-injection')).toEqual(EMPTY_PROGRESS);

    window.localStorage.setItem('vvwa.learningProgress', '["unexpected-array"]');
    const second = renderHook(() => useLearningProgress());
    expect(second.result.current.progressByLab).toEqual({});
  });

  it('recommends the next unpassed lab after currentLabId and wraps around', () => {
    const { result } = renderHook(() => useLearningProgress());
    expect(result.current.findNextRecommendedLab(SAMPLE_LABS, '01-sql-injection')?.id).toBe(
      '02-stored-xss',
    );

    act(() => result.current.markPassedVerify('02-stored-xss'));
    expect(result.current.findNextRecommendedLab(SAMPLE_LABS, '01-sql-injection')?.id).toBe(
      '07-file-upload',
    );

    act(() => result.current.markPassedVerify('07-file-upload'));
    expect(result.current.findNextRecommendedLab(SAMPLE_LABS, '02-stored-xss')?.id).toBe(
      '01-sql-injection',
    );

    act(() => result.current.markPassedVerify('01-sql-injection'));
    expect(result.current.findNextRecommendedLab(SAMPLE_LABS, '01-sql-injection')).toBeNull();
  });
});

describe('WelcomeBanner', () => {
  it('renders when visible, triggers all 3 actions, and returns null when hidden', () => {
    const onOpenCatalog = vi.fn();
    const onOpenGlossary = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <WelcomeBanner
        isVisible={false}
        onOpenCatalog={onOpenCatalog}
        onOpenGlossary={onOpenGlossary}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.queryByRole('region', { name: 'Hướng dẫn làm quen VVWA' })).toBeNull();

    rerender(
      <WelcomeBanner
        isVisible
        onOpenCatalog={onOpenCatalog}
        onOpenGlossary={onOpenGlossary}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('region', { name: 'Hướng dẫn làm quen VVWA' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem lộ trình 9 bài lab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở từ điển bảo mật' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đã hiểu, ẩn hướng dẫn' }));

    expect(onOpenCatalog).toHaveBeenCalledTimes(1);
    expect(onOpenGlossary).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('LabStepperCard', () => {
  it('shows 0/4 progress with shortcut buttons and congratulates at 4/4', () => {
    const onSwitchMode = vi.fn();
    const onOpenDiff = vi.fn();
    const onOpenVerify = vi.fn();

    const { rerender } = render(
      <LabStepperCard
        labTitle="SQL Injection"
        progress={EMPTY_PROGRESS}
        mode="vulnerable"
        activeTab="backend"
        onSwitchMode={onSwitchMode}
        onOpenDiff={onOpenDiff}
        onOpenVerify={onOpenVerify}
      />,
    );

    expect(screen.getByText('0 / 4 bước')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang Secure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở tab Diff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở Test My Fix' }));

    expect(onSwitchMode).toHaveBeenCalledWith('secure');
    expect(onOpenDiff).toHaveBeenCalledTimes(1);
    expect(onOpenVerify).toHaveBeenCalledTimes(1);

    rerender(
      <LabStepperCard
        labTitle="SQL Injection"
        progress={{
          exploredVulnerable: true,
          comparedSecure: true,
          viewedDiff: true,
          passedVerify: true,
        }}
        mode="secure"
        activeTab="diff"
        onSwitchMode={onSwitchMode}
        onOpenDiff={onOpenDiff}
        onOpenVerify={onOpenVerify}
      />,
    );

    expect(screen.getByText('4 / 4 bước')).toBeInTheDocument();
    expect(
      screen.getByText('Chúc mừng! Bạn đã hoàn thành cả 4 bước của bài lab này.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chuyển sang Secure' })).toBeNull();
  });
});

describe('LabCatalogModal', () => {
  it('filters by difficulty and search query, shows progress, and selects a lab', () => {
    const onSelectLab = vi.fn();
    const onClose = vi.fn();
    const getLabProgress = (labId: string): LabStepProgress =>
      labId === '01-sql-injection'
        ? {
            exploredVulnerable: true,
            comparedSecure: true,
            viewedDiff: true,
            passedVerify: true,
          }
        : EMPTY_PROGRESS;

    render(
      <LabCatalogModal
        isOpen
        labs={SAMPLE_LABS}
        selectedLabId="01-sql-injection"
        getLabProgress={getLabProgress}
        onSelectLab={onSelectLab}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Đã hoàn thành 1 / 3 bài lab')).toBeInTheDocument();
    expect(screen.getByText('Đã vượt qua')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đang học' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trung bình' }));
    expect(screen.queryByText('SQL Injection')).toBeNull();
    expect(screen.getByText('Unrestricted File Upload')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm bài lab' }), {
      target: { value: 'xss' },
    });
    expect(screen.queryByText('SQL Injection')).toBeNull();
    expect(screen.getByText('Stored XSS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học' }));
    expect(onSelectLab).toHaveBeenCalledWith('02-stored-xss');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
