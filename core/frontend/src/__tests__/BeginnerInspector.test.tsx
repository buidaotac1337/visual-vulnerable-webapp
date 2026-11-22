import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CodeInspector,
  GlowingCodeLine,
  InspectorHeader,
  TraceLegendBar,
  UnifiedDiffView,
} from '@/components';
import type { LabMetadata, LabSourceResponse, TraceLayer, TraceStatus, TraceStep } from '@/types';

const DEMO_LAB: LabMetadata = {
  id: '01-sql-injection',
  title: 'SQL Injection',
  category: 'Injection',
  difficulty: 'Cơ bản',
  summary: 'SQLi demo.',
  safetyPattern: 'Parameterized query.',
  samplePayloads: [],
  verifyTests: [],
};

const DEMO_SOURCE: LabSourceResponse = {
  lab_id: '01-sql-injection',
  vulnerable: {
    code: 'async def login(payload, db):\n    return 1',
    steps: { 'be-run': 2 },
    line_count: 2,
  },
  secure: {
    code: 'async def login(payload, db):\n    return 2',
    steps: { 'be-run': 2 },
    line_count: 2,
  },
  frontend: null,
  frontend_vulnerable: {
    code: 'export const Sink = "vuln";',
    steps: { 'fe-sink': 1 },
    line_count: 1,
  },
  frontend_secure: {
    code: 'export const Sink = "safe";',
    steps: { 'fe-sink': 1 },
    line_count: 1,
  },
  diff: '--- vulnerable.py\n+++ secure.py\n@@ -1,2 +1,2 @@\n async def login(payload, db):\n-    return 1\n+    return 2\n',
  frontend_diff:
    '--- vulnerable.tsx\n+++ secure.tsx\n@@ -1 +1 @@\n-export const Sink = "vuln";\n+export const Sink = "safe";\n',
};

function makeStep(layer: TraceLayer, status: TraceStatus): TraceStep {
  return {
    step: 2,
    layer,
    tag: 'be-run',
    status,
    title: 'Kiểm tra truy vấn',
    detail: 'SELECT * FROM users WHERE username = $1',
  };
}

describe('TraceLegendBar', () => {
  it('renders 4 status colors and onboarding tip before trace, hides tip with trace, and hides on diff', () => {
    const { container, rerender } = render(
      <TraceLegendBar hasTrace={false} activeTab="backend" mode="vulnerable" />,
    );
    expect(screen.getByText('Thông tin')).toBeInTheDocument();
    expect(screen.getByText('Cảnh báo')).toBeInTheDocument();
    expect(screen.getByText('Lỗ hổng')).toBeInTheDocument();
    expect(screen.getByText('Đã chặn')).toBeInTheDocument();
    expect(screen.getByText(/Mẹo: chọn 1 Payload mẫu bên trái/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<TraceLegendBar hasTrace activeTab="frontend" mode="secure" />);
    expect(screen.queryByText(/Mẹo: chọn 1 Payload mẫu bên trái/)).toBeNull();

    rerender(<TraceLegendBar hasTrace={false} activeTab="diff" mode="vulnerable" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GlowingCodeLine beginner badges and detail wrapping', () => {
  it.each<[TraceLayer, string, TraceStatus, string]>([
    ['frontend', 'MiniShop UI', 'warning', 'Cảnh báo rủi ro'],
    ['backend', 'FastAPI Backend', 'danger', 'Lỗ hổng kích hoạt'],
    ['database', 'PostgreSQL DB', 'safe', 'Đã chặn an toàn'],
    ['backend', 'FastAPI Backend', 'info', 'Xử lý bình thường'],
  ])('renders %s -> %s and %s -> %s', (layer, layerLabel, status, statusLabel) => {
    render(
      <GlowingCodeLine
        lineNumber={2}
        tokens={[{ content: 'return 1' }]}
        activeStep={makeStep(layer, status)}
      />,
    );
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Bước 2: Kiểm tra truy vấn');
    expect(note).toHaveTextContent(layerLabel);
    expect(note).toHaveTextContent(statusLabel);

    const detail = screen.getByText('SELECT * FROM users WHERE username = $1');
    expect(detail.className).toContain('whitespace-pre-wrap');
    expect(detail.className).toContain('break-words');
    expect(detail.className).not.toContain('break-all');
  });
});

describe('UnifiedDiffView beginner diff guide & copyable edit path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows diff legend and copies editFilePath', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(
      <UnifiedDiffView
        diff={DEMO_SOURCE.diff}
        editFilePath="labs/01-sql-injection/backend/vulnerable.py"
      />,
    );

    expect(screen.getByText('Hướng dẫn đọc Diff:')).toBeInTheDocument();
    expect(screen.getByText('Dòng lỗi cần bỏ/sửa')).toBeInTheDocument();
    expect(screen.getByText('Dòng an toàn nên thay bằng')).toBeInTheDocument();
    expect(screen.getByText('labs/01-sql-injection/backend/vulnerable.py')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sao chép/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('labs/01-sql-injection/backend/vulnerable.py');
    });
    expect(screen.getByText('Đã chép')).toBeInTheDocument();
  });

  it('keeps clean empty diff message without diff guide', () => {
    render(<UnifiedDiffView diff="" editFilePath="labs/01-sql-injection/backend/vulnerable.py" />);
    expect(screen.getByText(/Không có khác biệt/)).toBeInTheDocument();
    expect(screen.queryByText('Hướng dẫn đọc Diff:')).toBeNull();
  });
});

describe('InspectorHeader & CodeInspector beginner integrations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies fullFilePath from InspectorHeader when provided', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(
      <InspectorHeader
        activeTab="backend"
        mode="vulnerable"
        frontendFileLabel={null}
        hasFrontendDiff={false}
        canRefresh
        isRefreshing={false}
        fullFilePath="labs/01-sql-injection/backend/vulnerable.py"
        onSelectTab={vi.fn()}
        onRefreshSource={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Sao chép đường dẫn/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('labs/01-sql-injection/backend/vulnerable.py');
    });
    expect(screen.getByText('Đã chép')).toBeInTheDocument();
  });

  it('wires fullFilePath, TraceLegendBar, and Diff editFilePath inside CodeInspector', () => {
    const baseProps = {
      lab: DEMO_LAB,
      mode: 'vulnerable' as const,
      source: DEMO_SOURCE,
      sourceError: null,
      isRefreshing: false,
      totalSteps: 0,
      activeIndex: -1,
      activeStep: null,
      playbackStatus: 'idle' as const,
      onChangeTab: vi.fn(),
      onRefreshSource: vi.fn(),
      onPrevStep: vi.fn(),
      onReplayTrace: vi.fn(),
      onNextStep: vi.fn(),
    };

    const { rerender } = render(<CodeInspector {...baseProps} activeTab="backend" />);
    expect(
      screen.getByRole('button', {
        name: 'Sao chép đường dẫn: labs/01-sql-injection/backend/vulnerable.py',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mẹo: chọn 1 Payload mẫu bên trái/)).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    rerender(<CodeInspector {...baseProps} activeTab="frontend" mode="secure" />);
    expect(
      screen.getByRole('button', {
        name: 'Sao chép đường dẫn: labs/01-sql-injection/frontend/secure.tsx',
      }),
    ).toBeInTheDocument();

    rerender(<CodeInspector {...baseProps} activeTab="diff" />);
    expect(screen.queryByText(/Mẹo: chọn 1 Payload mẫu bên trái/)).toBeNull();
    expect(screen.getByText('labs/01-sql-injection/backend/vulnerable.py')).toBeInTheDocument();
    expect(screen.getByText('labs/01-sql-injection/frontend/vulnerable.tsx')).toBeInTheDocument();
  });
});
