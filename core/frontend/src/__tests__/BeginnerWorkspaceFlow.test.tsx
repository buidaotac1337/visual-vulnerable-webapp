import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabSourceResponse,
  VerifyLabResponse,
} from '@/types';

const HEALTH: HealthResponse = {
  status: 'ok',
  service: 'VVWA API',
  version: '0.1.0',
  environment: 'test',
};

const LABS: LabListResponse = {
  labs: [
    {
      id: '01-sql-injection',
      title: 'SQL Injection — Đăng nhập & Tìm kiếm MiniShop',
      category: 'Injection',
      difficulty: 'Cơ bản',
      summary: 'Khai thác nối chuỗi f-string vào SQL.',
      safetyPattern: 'Dùng Parameterized Query ($1, $2).',
      samplePayloads: [
        {
          label: 'Bypass Admin Login',
          description: 'Tiêm OR 1=1-- để vượt đăng nhập.',
          data: { tab: 'login', username: "' OR 1=1--", password: 'any' },
        },
        {
          label: 'Đăng nhập thường (alice)',
          description: 'Luồng hợp lệ với tài khoản alice.',
          data: { tab: 'login', username: 'alice', password: 'password123' },
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
    {
      id: '02-stored-xss',
      title: 'Stored XSS — Đánh giá sản phẩm MiniShop',
      category: 'XSS',
      difficulty: 'Cơ bản',
      summary: 'Chèn HTML độc hại vào đánh giá sản phẩm.',
      safetyPattern: 'Render dạng chữ để React tự escape.',
      samplePayloads: [],
      verifyTests: [],
    },
  ],
};

const SOURCE: LabSourceResponse = {
  lab_id: '01-sql-injection',
  vulnerable: {
    code: 'async def login(payload, db):\n    sql = f"SELECT * FROM users"\n    return sql',
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
    '-    sql = f"SELECT * FROM users"',
    '+    sql = "SELECT * FROM users WHERE username = $1"',
    '     return sql',
  ].join('\n'),
};

const EXEC_VULN: LabExecutionResponse = {
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
      detail: 'SELECT * FROM users',
    },
  ],
};

const EXEC_SECURE: LabExecutionResponse = {
  ok: true,
  data: { logged_in: false },
  meta: { lab_id: '01-sql-injection', mode: 'secure', outcome: 'blocked' },
  trace: [
    {
      step: 1,
      layer: 'backend',
      tag: 'build-query',
      status: 'safe',
      title: 'Truy vấn tham số hóa',
      detail: 'SELECT * FROM users WHERE username = $1',
    },
  ],
};

const VERIFY_PASS: VerifyLabResponse = {
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

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    blob: async () => new Blob(['zip']),
  } as unknown as Response;
}

describe('Beginner end-to-end UX workspace flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('connects onboarding, glossary deep-link, 4-step progress, outcome coach, diff guide, and next-lab CTA', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/health') return okJson(HEALTH);
        if (url === '/api/labs') return okJson(LABS);
        if (url === '/api/labs/01-sql-injection/source') return okJson(SOURCE);
        if (url === '/api/labs/01-sql-injection/vulnerable/login') return okJson(EXEC_VULN);
        if (url === '/api/labs/01-sql-injection/secure/login') return okJson(EXEC_SECURE);
        if (url === '/api/labs/01-sql-injection/verify?reset_db=true') return okJson(VERIFY_PASS);
        return okJson({});
      }),
    );

    render(<App />);

    // First visit shows non-blocking welcome banner + beginner card + trace legend tip
    expect(
      await screen.findByText('Chào mừng đến với Visual Vulnerable Web App'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mẹo: chọn 1 Payload mẫu bên trái rồi bấm gửi/)).toBeInTheDocument();

    // Dismiss welcome banner
    fireEvent.click(screen.getByRole('button', { name: 'Đã hiểu, ẩn hướng dẫn' }));
    expect(screen.queryByText('Chào mừng đến với Visual Vulnerable Web App')).toBeNull();

    // Open beginner guide card and jump directly to a highlighted glossary term
    fireEvent.click(screen.getByRole('button', { name: /Hiểu nhanh trong 30 giây/ }));
    fireEvent.click(screen.getByRole('button', { name: 'SQL Injection (SQLi)' }));
    expect(await screen.findByText('Từ điển Bảo mật & Giao diện VVWA')).toBeInTheDocument();
    expect(document.querySelector('[data-term-id="sql-injection"]')).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng từ điển' }));

    // Open catalog from TopControlBar and verify 0/2 counter
    const catalogBtn = screen.getByRole('button', { name: 'Lộ trình' });
    expect(catalogBtn).toHaveTextContent('0/2');
    fireEvent.click(catalogBtn);
    expect(await screen.findByText('Lộ trình học 2 bài lab bảo mật')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng danh sách bài lab' }));

    // Execute vulnerable action -> OutcomeCoachPanel suggests switching to Secure
    const loginBtn = await screen.findByRole('button', { name: 'Đăng nhập MiniShop' });
    fireEvent.click(loginBtn);
    const switchBtn = await screen.findByRole('button', { name: 'Gạt sang Secure để so sánh' });
    expect(await screen.findByText('1 / 4 bước')).toBeInTheDocument();

    // Click coaching CTA -> switches to Secure, run again -> marks step 2 + shows Diff CTA
    fireEvent.click(switchBtn);
    expect(screen.getByRole('radio', { name: 'Secure' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập MiniShop' }));
    const openDiffBtn = await screen.findByRole('button', { name: 'Xem Diff bản vá' });
    expect(await screen.findByText('2 / 4 bước')).toBeInTheDocument();

    // Click Diff CTA -> opens Diff tab with beginner legend & marks step 3
    fireEvent.click(openDiffBtn);
    expect(await screen.findByText(/Dòng lỗi cần bỏ\/sửa/)).toBeInTheDocument();
    expect(await screen.findByText('3 / 4 bước')).toBeInTheDocument();

    // Run Test My Fix -> passes, marks step 4, updates counter to 1/2, offers next lab CTA
    fireEvent.click(screen.getByRole('button', { name: 'Test My Fix' }));
    expect(await screen.findByText(/1 \/ 1 PASS/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lộ trình' })).toHaveTextContent('1/2');
    });
    expect(screen.getByRole('button', { name: /Học tiếp: Stored XSS/ })).toBeInTheDocument();
  });
});
