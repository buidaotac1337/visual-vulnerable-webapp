import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabMode,
  LabSourceResponse,
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
      id: '01-sqli',
      title: 'Lab 01 SQLi',
      category: 'Injection',
      difficulty: 'Cơ bản',
      summary: 'SQLi login lab.',
      safetyPattern: 'Use $1, $2.',
      samplePayloads: [
        { label: 'Bypass', description: 'OR 1=1', data: { username: "' OR 1=1--" } },
      ],
      verifyTests: [{ name: 'T1', action: 'login', input: {}, expect: {} }],
    },
  ],
};

const SOURCE: LabSourceResponse = {
  lab_id: '01-sqli',
  vulnerable: {
    code: 'async def login(payload, db):\n    sql = f"SELECT {u}"\n    return await db.fetch_one(sql)',
    steps: { 'build-login-query': 2, 'exec-login-query': 3 },
    line_count: 3,
  },
  secure: {
    code: 'async def login(payload, db):\n    sql = "SELECT $1"\n    return await db.fetch_one(sql, u)',
    steps: { 'build-login-query': 2, 'exec-login-query': 3 },
    line_count: 3,
  },
  frontend: null,
  diff: '--- vulnerable.py\n+++ secure.py\n@@ -2 +2 @@\n-old\n+new\n',
};

function loginResponse(mode: LabMode): LabExecutionResponse {
  const isVuln = mode === 'vulnerable';
  return {
    ok: true,
    data: { logged_in: isVuln },
    meta: { lab_id: '01-sqli', mode, outcome: isVuln ? 'exploited' : 'blocked' },
    trace: [
      {
        step: 1,
        layer: 'backend',
        tag: 'build-login-query',
        status: isVuln ? 'danger' : 'safe',
        title: isVuln ? 'Nối chuỗi f-string' : 'Parameterized query',
        detail: isVuln ? "SQL thực tế: ... '' OR 1=1--'" : 'SQL: ... = $1',
      },
      {
        step: 2,
        layer: 'database',
        tag: 'exec-login-query',
        status: isVuln ? 'danger' : 'safe',
        title: isVuln ? 'Bypass thành công' : 'Không có user khớp',
        detail: '',
      },
    ],
  };
}

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function stubBackend(): string[] {
  const posts: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(url);
      }
      if (url === '/api/health') return okJson(HEALTH);
      if (url === '/api/labs') return okJson(LABS);
      if (url === '/api/labs/01-sqli/source') return okJson(SOURCE);
      if (url === '/api/system/reset-db') {
        return okJson({ ok: true, message: 'reset', duration_ms: 3 });
      }
      if (url === '/api/labs/01-sqli/secure/login') return okJson(loginResponse('secure'));
      if (url === '/api/labs/01-sqli/vulnerable/login') return okJson(loginResponse('vulnerable'));
      return { ok: false, status: 404, json: async () => ({ detail: url }) } as Response;
    }),
  );
  return posts;
}

describe('Song song compare mode (ADR-0010)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs one payload on both sides from seed and shows both files and traces side by side', async () => {
    const posts = stubBackend();
    render(<App />);
    await screen.findByText('SQLi login lab.');

    const modes = screen.getByRole('radiogroup', { name: 'Chế độ thực thi bài lab' });
    fireEvent.click(within(modes).getByRole('radio', { name: /Song song/ }));

    expect(within(modes).getByRole('radio', { name: /Song song/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('note')).toHaveTextContent('Reset DB rồi chạy Secure');
    expect(await screen.findByRole('region', { name: 'Mã nguồn vulnerable.py' })).toHaveTextContent(
      'f"SELECT {u}"',
    );
    expect(screen.getByRole('region', { name: 'Mã nguồn secure.py' })).toHaveTextContent(
      '"SELECT $1"',
    );

    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }));

    expect(await screen.findByTestId('compare-outcome-vulnerable')).toHaveTextContent(
      'Vulnerable: bị khai thác',
    );
    expect(screen.getByTestId('compare-outcome-secure')).toHaveTextContent('Secure: đã chặn');
    expect(posts).toEqual([
      '/api/system/reset-db',
      '/api/labs/01-sqli/secure/login',
      '/api/system/reset-db',
      '/api/labs/01-sqli/vulnerable/login',
    ]);

    const table = screen.getByRole('list', { name: 'Trace Song song căn theo bước' });
    const rows = within(table).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Nối chuỗi f-string');
    expect(rows[0]).toHaveTextContent('Parameterized query');

    const dots = within(modes).getAllByTestId('mode-outcome-dot');
    expect(dots.map((dot) => dot.getAttribute('data-outcome'))).toEqual(['exploited', 'blocked']);

    fireEvent.click(rows[1] as HTMLElement);
    expect(rows[1]).toHaveAttribute('aria-current', 'step');
  });

  it('leaves Song song cleanly: single mode shows one file and keeps the outcome dots', async () => {
    stubBackend();
    render(<App />);
    await screen.findByText('SQLi login lab.');

    const modes = screen.getByRole('radiogroup', { name: 'Chế độ thực thi bài lab' });
    fireEvent.click(within(modes).getByRole('radio', { name: /Song song/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Gửi yêu cầu/ }));
    await screen.findByTestId('compare-outcome-secure');

    fireEvent.click(within(modes).getByRole('radio', { name: /^Secure/ }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Mã nguồn secure.py' })).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('compare-outcome-secure')).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(within(modes).getAllByTestId('mode-outcome-dot')).toHaveLength(2);
  });
});
