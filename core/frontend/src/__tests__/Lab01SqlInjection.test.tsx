import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView } from '@/lib';
import type { LabExecutionResponse, LabMetadata, LabViewProps } from '@/types';

import { LabView } from '../../../../labs/01-sql-injection/frontend/LabView';

const LAB_01_META: LabMetadata = {
  id: '01-sql-injection',
  title: 'SQL Injection — Đăng nhập & Tìm kiếm MiniShop',
  category: 'Injection',
  difficulty: 'Cơ bản',
  summary: 'SQLi demo.',
  safetyPattern: 'Use $1, $2.',
  samplePayloads: [],
  verifyTests: [],
};

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_01_META,
    mode: 'vulnerable',
    actor: null,
    payload: { tab: 'login', username: "' OR 1=1--", password: 'any' },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => null),
    ...overrides,
  };
}

describe('Lab 01 SQL Injection LabView', () => {
  it('is auto-discovered by Vite import.meta.glob in labRegistry', () => {
    expect(hasLabView('01-sql-injection')).toBe(true);
  });

  it('submits login action with fe-login-submit frontend trace and renders admin exploit card', () => {
    const onExecute = vi.fn(async () => null);
    const exploitedResp: LabExecutionResponse = {
      ok: true,
      data: {
        logged_in: true,
        user: { username: 'admin', email: 'admin@minishop.local', role: 'admin', balance: 9999 },
      },
      meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'exploited' },
      trace: [],
    };

    render(<LabView {...makeProps({ onExecute, lastResponse: exploitedResp })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập MiniShop' }));
    expect(onExecute).toHaveBeenCalledWith(
      'login',
      { username: "' OR 1=1--", password: 'any' },
      expect.objectContaining({
        frontendStepsBefore: [
          expect.objectContaining({ layer: 'frontend', tag: 'fe-login-submit' }),
        ],
      }),
    );
    expect(screen.getByText('Chào mừng admin!')).toBeInTheDocument();
    // The welcome card is neutral; the bypass is explained in a separate alert.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Đăng nhập vào tài khoản admin mà không cần mật khẩu đúng',
    );
  });

  it('shows a normal login without any alert', () => {
    const normalResp: LabExecutionResponse = {
      ok: true,
      data: {
        logged_in: true,
        user: { username: 'alice', email: 'alice@minishop.local', role: 'customer', balance: 500 },
      },
      meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'normal' },
      trace: [],
    };
    render(<LabView {...makeProps({ lastResponse: normalResp })} />);
    expect(screen.getByText('Chào mừng alice!')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders SQL syntax error banner and failed login card cleanly', () => {
    const sqlErrResp: LabExecutionResponse = {
      ok: true,
      data: { logged_in: false, user: null, sql_error: 'syntax error at or near end of input' },
      meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'error' },
      trace: [],
    };
    const { rerender } = render(<LabView {...makeProps({ lastResponse: sqlErrResp })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi cú pháp SQL (Error-based SQLi)');
    expect(screen.getByRole('alert')).toHaveTextContent('syntax error at or near end of input');

    const failedResp: LabExecutionResponse = {
      ok: true,
      data: { logged_in: false, user: null },
      meta: { lab_id: '01-sql-injection', mode: 'secure', outcome: 'blocked' },
      trace: [],
    };
    rerender(<LabView {...makeProps({ lastResponse: failedResp })} />);
    expect(screen.getByText(/Đăng nhập thất bại/)).toBeInTheDocument();
  });

  it('switches sub-tabs, updates payload on input typing, and renders search states', () => {
    const onPayloadChange = vi.fn();
    const onExecute = vi.fn(async () => null);
    const { rerender } = render(<LabView {...makeProps({ onPayloadChange, onExecute })} />);

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), { target: { value: 'alice' } });
    expect(onPayloadChange).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'login', username: 'alice' }),
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Tìm kiếm sản phẩm' }));
    expect(onPayloadChange).toHaveBeenCalledWith(expect.objectContaining({ tab: 'search' }));

    const searchResp: LabExecutionResponse = {
      ok: true,
      data: {
        count: 1,
        leaked_rows: [0],
        products: [
          {
            id: 1,
            name: 'admin',
            description: 'admin@minishop.local:admin_secret_2026',
            price: 9999,
            stock: 0,
          },
        ],
      },
      meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'exploited' },
      trace: [],
    };

    rerender(
      <LabView
        {...makeProps({
          payload: { tab: 'search', keyword: "' AND 1=0 UNION SELECT ..." },
          onExecute,
          lastResponse: searchResp,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm sản phẩm' }));
    expect(onExecute).toHaveBeenCalledWith(
      'search_products',
      { keyword: "' AND 1=0 UNION SELECT ..." },
      expect.objectContaining({
        frontendStepsBefore: [
          expect.objectContaining({ layer: 'frontend', tag: 'fe-search-submit' }),
        ],
      }),
    );
    expect(screen.getByText('admin@minishop.local:admin_secret_2026')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 dòng bên dưới không phải sản phẩm');

    rerender(
      <LabView
        {...makeProps({
          payload: { tab: 'search', keyword: 'none' },
          lastResponse: {
            ok: true,
            data: { count: 0, products: [] },
            meta: { lab_id: '01-sql-injection', mode: 'secure', outcome: 'normal' },
            trace: [],
          },
        })}
      />,
    );
    expect(screen.getByText('Không tìm thấy sản phẩm nào khớp từ khóa.')).toBeInTheDocument();
  });
});
