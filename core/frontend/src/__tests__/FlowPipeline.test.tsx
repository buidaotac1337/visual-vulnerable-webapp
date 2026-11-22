import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FlowPipeline } from '@/components';
import {
  computePipelineNodes,
  derivePipelineModel,
  findNextStepIndexForLayer,
  formatHopRoute,
} from '@/lib';
import type { LabExecutionResponse, LastExecutionRequest, TraceStep } from '@/types';

const SQLI_REQUEST: LastExecutionRequest = {
  labId: '01-sql-injection',
  mode: 'vulnerable',
  actor: 'alice',
  action: 'login',
  body: { username: "' OR 1=1--", password: 'any' },
};

const SQLI_RESPONSE: LabExecutionResponse = {
  ok: true,
  data: { logged_in: true, user: { username: 'admin', role: 'admin' } },
  meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'exploited' },
  trace: [],
};

const SQLI_TRACE: TraceStep[] = [
  {
    step: 1,
    layer: 'frontend',
    tag: 'fe-login',
    status: 'info',
    title: 'Gửi form đăng nhập',
    detail: 'POST /api/labs/01-sql-injection/vulnerable/login',
  },
  {
    step: 2,
    layer: 'backend',
    tag: 'build-login-query',
    status: 'danger',
    title: 'Nối chuỗi f-string',
    detail: "SQL thực tế: SELECT * FROM users WHERE username = '' OR 1=1--'",
  },
  {
    step: 3,
    layer: 'database',
    tag: 'exec-login-query',
    status: 'danger',
    title: 'PostgreSQL thực thi SQL thô',
    detail: "Bypass thành công! Trả về user 'admin' (role=admin).",
  },
];

const SSRF_BLOCKED_TRACE: TraceStep[] = [
  {
    step: 1,
    layer: 'frontend',
    tag: 'fe-fetch',
    status: 'info',
    title: 'Gửi URL ảnh',
    detail: 'POST /api/labs/09-ssrf/secure/fetch_product_image',
  },
  {
    step: 2,
    layer: 'backend',
    tag: 'parse-url',
    status: 'info',
    title: 'Phân tích URL',
    detail: 'http://internal-metadata:9000/latest/meta-data/secrets',
  },
  {
    step: 3,
    layer: 'backend',
    tag: 'validate-target',
    status: 'safe',
    title: 'Chặn đích SSRF',
    detail: "Host 'internal-metadata' không nằm trong allowlist được phép.",
  },
];

describe('pipelineWires & traceEngine helpers', () => {
  it('derives forward/return wire transitions, self-loop, and DB block gate accurately', () => {
    const step2Model = derivePipelineModel(SQLI_TRACE, 1, SQLI_REQUEST, SQLI_RESPONSE);
    expect(step2Model.uiBe.forward.state).toBe('active');
    expect(step2Model.uiBe.forward.tone).toBe('danger');
    expect(step2Model.beDb.forward.state).toBe('idle');
    expect(step2Model.hopRoute).toBe('UI → FastAPI');
    expect(step2Model.wirePayloads.uiBeFwd.full).toContain('X-VVWA-Actor: alice');
    expect(step2Model.wirePayloads.uiBeFwd.full).toContain("' OR 1=1--");
    expect(step2Model.wirePayloads.beDbFwd.compact).toContain('SELECT * FROM users');

    const step3Model = derivePipelineModel(SQLI_TRACE, 2, SQLI_REQUEST, SQLI_RESPONSE);
    expect(step3Model.uiBe.forward.state).toBe('passed');
    expect(step3Model.beDb.forward.state).toBe('active');
    expect(step3Model.hopRoute).toBe('FastAPI → PostgreSQL');

    const blockedModel = derivePipelineModel(SSRF_BLOCKED_TRACE, 2, null, {
      ok: true,
      data: { blocked: true, fetched: false },
      meta: { lab_id: '09-ssrf', mode: 'secure', outcome: 'blocked' },
      trace: [],
    });
    expect(blockedModel.blockedBeforeDb).toBe(true);
    expect(blockedModel.isSelfLoop).toBe(true);
    expect(blockedModel.beDb.forward.state).toBe('blocked');
    expect(blockedModel.beDb.reverse.state).toBe('muted');
    expect(blockedModel.hopRoute).toBe('FastAPI · xử lý nội bộ');
    expect(blockedModel.wirePayloads.beDbFwd.label).toContain('Cổng chặn trước DB');
    expect(blockedModel.wirePayloads.uiBeRev.compact).toContain('outcome="blocked"');
  });

  it('formats return hop routes and cycles through multiple steps on the same layer', () => {
    const dbStep: TraceStep = {
      step: 2,
      layer: 'database',
      tag: 'db',
      status: 'info',
      title: 'DB',
      detail: 'rows',
    };
    const feReturn: TraceStep = {
      step: 3,
      layer: 'frontend',
      tag: 'fe-render',
      status: 'danger',
      title: 'DOM render',
      detail: 'XSS',
    };
    expect(formatHopRoute(dbStep, feReturn)).toBe('PostgreSQL → UI (trả về)');
    expect(findNextStepIndexForLayer(SSRF_BLOCKED_TRACE, 'backend', 0)).toBe(1);
    expect(findNextStepIndexForLayer(SSRF_BLOCKED_TRACE, 'backend', 1)).toBe(2);
    expect(findNextStepIndexForLayer(SSRF_BLOCKED_TRACE, 'backend', 2)).toBe(1);
    expect(findNextStepIndexForLayer(SSRF_BLOCKED_TRACE, 'database', 0)).toBe(-1);
  });
});

describe('FlowPipeline component (Full Data Journey)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders clean idle state without packet strip or journey toggle', () => {
    const nodes = computePipelineNodes([], -1, false);
    render(<FlowPipeline nodes={nodes} onSelectLayer={vi.fn()} />);

    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. MiniShop UI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2. FastAPI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '3. PostgreSQL' })).toBeDisabled();
    expect(screen.queryByText(/Hành trình dữ liệu đầy đủ/)).toBeNull();
  });

  it('renders Live Data Packet Strip, expandable journey timeline, and click-to-jump', () => {
    const onSelectStep = vi.fn();
    const nodes = computePipelineNodes(SQLI_TRACE, 1, true);
    render(
      <FlowPipeline
        nodes={nodes}
        trace={SQLI_TRACE}
        activeIndex={1}
        playbackStatus="paused"
        playbackSpeed="1x"
        lastRequest={SQLI_REQUEST}
        lastResponse={SQLI_RESPONSE}
        onSelectLayer={vi.fn()}
        onSelectStep={onSelectStep}
      />,
    );

    expect(screen.getByText('Bước 2 / 3')).toBeInTheDocument();
    expect(screen.getByText('UI → FastAPI')).toBeInTheDocument();
    expect(screen.getByText(/SQL thực tế: SELECT \* FROM users/)).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Hành trình dữ liệu đầy đủ \(3 bước\)/ });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /03.*PostgreSQL thực thi SQL thô/ }));
    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  it('shows hoverable wire popover, toggles Thu gọn/Đầy đủ without auto-hiding, persists mode, and closes on Escape', () => {
    vi.useFakeTimers();
    const onSelectStep = vi.fn();
    const nodes = computePipelineNodes(SQLI_TRACE, 2, true);
    render(
      <FlowPipeline
        nodes={nodes}
        trace={SQLI_TRACE}
        activeIndex={2}
        playbackStatus="completed"
        lastRequest={SQLI_REQUEST}
        lastResponse={SQLI_RESPONSE}
        onSelectLayer={vi.fn()}
        onSelectStep={onSelectStep}
      />,
    );

    const httpLane = screen.getByRole('button', { name: 'Xem gói tin HTTP đi' });
    fireEvent.mouseEnter(httpLane);

    const dialog = screen.getByRole('dialog', { name: 'HTTP Request · UI → FastAPI' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Thu gọn' })).toHaveAttribute('aria-checked', 'true');
    expect(dialog.textContent).toContain('POST /api/labs/01-sql-injection/vulnerable/login');

    // Move mouse into popover and expand to Đầy đủ
    fireEvent.mouseLeave(httpLane);
    fireEvent.mouseEnter(dialog);
    fireEvent.click(screen.getByRole('radio', { name: 'Đầy đủ' }));
    expect(screen.getByRole('radio', { name: 'Đầy đủ' })).toHaveAttribute('aria-checked', 'true');
    expect(dialog.textContent).toContain('HTTP/1.1');
    expect(dialog.textContent).toContain('X-VVWA-Actor: alice');

    // Click Thu gọn while hovering popover -> must stay open past close timer!
    fireEvent.click(screen.getByRole('radio', { name: 'Thu gọn' }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Thu gọn' })).toHaveAttribute('aria-checked', 'true');

    // Switch to Đầy đủ, then hover SQL wire -> mode persists
    fireEvent.click(screen.getByRole('radio', { name: 'Đầy đủ' }));
    const sqlLane = screen.getByRole('button', { name: 'Xem gói tin SQL' });
    fireEvent.mouseEnter(sqlLane);
    expect(screen.getByRole('radio', { name: 'Đầy đủ' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('dialog').textContent).toContain('Bước 2 · Nối chuỗi f-string');

    // Clicking wire lane jumps to related step
    fireEvent.click(sqlLane);
    expect(onSelectStep).toHaveBeenCalledWith(2);

    // Escape closes popover immediately
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders Chặn DB shield gate and blocked popover when FastAPI blocks before DB', () => {
    const nodes = computePipelineNodes(SSRF_BLOCKED_TRACE, 2, true);
    render(
      <FlowPipeline
        nodes={nodes}
        trace={SSRF_BLOCKED_TRACE}
        activeIndex={2}
        playbackStatus="completed"
        onSelectLayer={vi.fn()}
      />,
    );

    expect(screen.getByText('Không bị chạm')).toBeInTheDocument();
    const gateBtn = screen.getByRole('button', {
      name: 'Xem chi tiết chặng bị chặn trước PostgreSQL',
    });
    fireEvent.mouseEnter(gateBtn);
    const dialog = screen.getByRole('dialog', {
      name: 'Cổng chặn trước DB · FastAPI ✕ PostgreSQL',
    });
    expect(dialog.textContent).toContain('Chặn đích SSRF');
  });
});
