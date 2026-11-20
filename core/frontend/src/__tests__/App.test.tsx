import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabSourceResponse,
  ResetDatabaseResponse,
  VerifyLabResponse,
} from '@/types';

const MOCK_HEALTH: HealthResponse = {
  status: 'ok',
  service: 'Visual Vulnerable Web App API',
  version: '0.1.0',
  environment: 'test',
};

const MOCK_LABS: LabListResponse = {
  labs: [
    {
      id: '01-sql-injection',
      title: 'SQL Injection — Đăng nhập MiniShop',
      category: 'Injection',
      difficulty: 'Cơ bản',
      summary: 'Khai thác lỗi nối chuỗi f-string trong SQL.',
      safetyPattern: 'Dùng Parameterized Query ($1, $2).',
      samplePayloads: [
        {
          label: 'Bypass Admin',
          description: 'Tiêm OR 1=1--',
          data: { username: "' OR 1=1--", password: 'any' },
        },
        {
          label: 'Đăng nhập thường',
          description: 'Tài khoản alice',
          data: { username: 'alice', password: 'password123' },
        },
      ],
      verifyTests: [
        {
          name: 'Chặn SQLi',
          action: 'login',
          input: { username: "' OR 1=1--", password: 'x' },
          expect: { logged_in: false },
        },
      ],
    },
  ],
};

const MOCK_SOURCE: LabSourceResponse = {
  lab_id: '01-sql-injection',
  vulnerable: {
    code: 'async def login(payload, db):\n    sql = f"SELECT * FROM users WHERE username = \'{u}\'"\n    return sql',
    steps: { 'build-query': 2 },
    line_count: 3,
  },
  secure: {
    code: 'async def login(payload, db):\n    sql = "SELECT * FROM users WHERE username = $1"\n    return sql',
    steps: { 'build-query': 2 },
    line_count: 3,
  },
  frontend: null,
  diff: [
    '--- vulnerable.py',
    '+++ secure.py',
    '@@ -1,3 +1,3 @@',
    ' async def login(payload, db):',
    '-    sql = f"SELECT * FROM users WHERE username = \'{u}\'"',
    '+    sql = "SELECT * FROM users WHERE username = $1"',
    '     return sql',
  ].join('\n'),
};

const MOCK_EXEC: LabExecutionResponse = {
  ok: true,
  data: { logged_in: true, user: { username: 'admin', role: 'admin' } },
  meta: { lab_id: '01-sql-injection', mode: 'vulnerable', outcome: 'exploited' },
  trace: [
    {
      step: 1,
      layer: 'backend',
      tag: 'build-query',
      status: 'danger',
      title: 'Nối chuỗi f-string',
      detail: "SELECT * FROM users WHERE username = '' OR 1=1--'",
    },
  ],
};

const MOCK_VERIFY: VerifyLabResponse = {
  ok: true,
  lab_id: '01-sql-injection',
  passed: true,
  total: 1,
  passed_count: 1,
  results: [
    {
      name: 'Chặn SQLi',
      action: 'login',
      passed: true,
      expected: { logged_in: false },
      actual: { logged_in: false },
      error: null,
    },
  ],
};

const MOCK_RESET: ResetDatabaseResponse = {
  ok: true,
  message: 'MiniShop database reset.',
  duration_ms: 4.2,
};

function makeJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    blob: async () => new Blob(['zip-bytes']),
  } as unknown as Response;
}

describe('VVWA Frontend Workspace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders clean empty onboarding state when GET /api/labs returns no labs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input === '/api/health') {
          return makeJsonResponse(MOCK_HEALTH);
        }
        return makeJsonResponse({ labs: [] });
      }),
    );

    render(<App />);

    expect(await screen.findByText(/API: OK/)).toBeInTheDocument();
    expect(
      await screen.findByText(/MiniShop Sandbox sẵn sàng — chưa có bài lab trong labs\//),
    ).toBeInTheDocument();
  });

  it('preserves user payload across mode toggles, renders live trace callout, diff, verify, and reset', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/health') {
        return makeJsonResponse(MOCK_HEALTH);
      }
      if (input === '/api/labs') {
        return makeJsonResponse(MOCK_LABS);
      }
      if (input === '/api/labs/01-sql-injection/source') {
        return makeJsonResponse(MOCK_SOURCE);
      }
      if (input === '/api/labs/01-sql-injection/vulnerable/login') {
        return makeJsonResponse(MOCK_EXEC);
      }
      if (input === '/api/labs/01-sql-injection/verify?reset_db=true') {
        return makeJsonResponse(MOCK_VERIFY);
      }
      if (input === '/api/system/reset-db') {
        return makeJsonResponse(MOCK_RESET);
      }
      return makeJsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // Wait for lab + source discovery
    expect(
      await screen.findByRole('heading', { name: 'SQL Injection — Đăng nhập MiniShop' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('[data-line-number="2"]')?.textContent).toContain(
        'SELECT * FROM users',
      );
    });

    // Apply 2nd sample payload chip and verify textarea updates
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập thường' }));
    const payloadInput = screen.getByLabelText('JSON Payload') as HTMLTextAreaElement;
    expect(payloadInput.value).toContain('alice');

    // Execute vulnerable action and verify inline callout glows
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/Bước 1: Nối chuỗi f-string/)).toBeInTheDocument();

    // Toggle to Secure: payload must be preserved, stale red callout must clear
    fireEvent.click(screen.getByRole('radio', { name: 'Secure' }));
    expect((screen.getByLabelText('JSON Payload') as HTMLTextAreaElement).value).toContain('alice');
    expect(screen.queryByText(/Bước 1: Nối chuỗi f-string/)).not.toBeInTheDocument();

    // Switch to Diff tab
    fireEvent.click(screen.getByRole('tab', { name: 'Diff' }));
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toBeInTheDocument();

    // Click Test My Fix -> must call ?reset_db=true and show modal
    fireEvent.click(screen.getByRole('button', { name: 'Test My Fix' }));
    expect(await screen.findByText(/1 \/ 1 PASS/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/labs/01-sql-injection/verify?reset_db=true',
      expect.objectContaining({ method: 'POST' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    // Click Reset DB
    fireEvent.click(screen.getByRole('button', { name: 'Reset DB' }));
    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục MiniShop DB \(4\.2 ms\)/)).toBeInTheDocument();
    });
  });
});
