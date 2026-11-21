import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodeInspector } from '@/components';
import type { InspectorTab, LabMode, LabSourceResponse } from '@/types';

const SOURCE: LabSourceResponse = {
  lab_id: '02-xss',
  vulnerable: {
    code: 'async def list_reviews(payload, db):\n    return {}',
    steps: {},
    line_count: 2,
  },
  secure: { code: 'async def list_reviews(payload, db):\n    return {}', steps: {}, line_count: 2 },
  frontend: { code: 'export function LabView() {}', steps: {}, line_count: 1 },
  diff: '',
  frontend_vulnerable: {
    code: 'export const ReviewContent = "VULN_SINK_MARKER";',
    steps: {},
    line_count: 1,
  },
  frontend_secure: {
    code: 'export const ReviewContent = "SAFE_SINK_MARKER";',
    steps: {},
    line_count: 1,
  },
  frontend_diff:
    '--- vulnerable.tsx\n+++ secure.tsx\n@@ -1 +1 @@\n-export const ReviewContent = "VULN_SINK_MARKER";\n+export const ReviewContent = "SAFE_SINK_MARKER";\n',
};

function renderInspector(
  activeTab: InspectorTab,
  mode: LabMode,
  source: LabSourceResponse = SOURCE,
): void {
  render(
    <CodeInspector
      lab={null}
      mode={mode}
      activeTab={activeTab}
      source={source}
      sourceError={null}
      isRefreshing={false}
      totalSteps={0}
      activeIndex={-1}
      activeStep={null}
      playbackStatus="idle"
      onChangeTab={vi.fn()}
      onRefreshSource={vi.fn()}
      onPrevStep={vi.fn()}
      onReplayTrace={vi.fn()}
      onNextStep={vi.fn()}
    />,
  );
}

describe('ADR-0006 frontend sink pair in the inspector', () => {
  it('shows the sink file matching the mode in the Frontend tab', () => {
    renderInspector('frontend', 'vulnerable');
    expect(screen.getByText('frontend/vulnerable.tsx')).toBeInTheDocument();
    expect(screen.getByText(/VULN_SINK_MARKER/)).toBeInTheDocument();
  });

  it('switches to secure.tsx in secure mode', () => {
    renderInspector('frontend', 'secure');
    expect(screen.getByText('frontend/secure.tsx')).toBeInTheDocument();
    expect(screen.getByText(/SAFE_SINK_MARKER/)).toBeInTheDocument();
  });

  it('shows backend and frontend diffs side by side in the Diff tab', () => {
    renderInspector('diff', 'vulnerable');
    expect(screen.getByText('Backend: vulnerable.py ↔ secure.py')).toBeInTheDocument();
    expect(screen.getByText('Frontend: vulnerable.tsx ↔ secure.tsx')).toBeInTheDocument();
    expect(screen.getByText(/Không có khác biệt — mã nguồn vulnerable.py/)).toBeInTheDocument();
    expect(screen.getAllByText(/SINK_MARKER/)).toHaveLength(2);
  });

  it('keeps the combined Diff header label when the frontend sink is already patched', () => {
    renderInspector('diff', 'vulnerable', { ...SOURCE, frontend_diff: '' });
    expect(screen.getByText('vulnerable ↔ secure (.py + .tsx)')).toBeInTheDocument();
    expect(screen.getByText(/mã nguồn vulnerable.tsx hiện khớp/)).toBeInTheDocument();
  });
});
