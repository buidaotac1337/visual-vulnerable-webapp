import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabSourceResponse,
} from '@/types';

const HEALTH: HealthResponse = {
  status: 'ok',
  service: 'VVWA API',
  version: '0.1.0',
  environment: 'test',
};

const TWO_LABS: LabListResponse = {
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
    {
      id: '02-xss',
      title: 'Lab 02 XSS',
      category: 'XSS',
      difficulty: 'Cơ bản',
      summary: 'Stored XSS review lab.',
      safetyPattern: 'Escape HTML.',
      samplePayloads: [{ label: 'Script', description: 'Alert', data: { content: '<b>hi</b>' } }],
      verifyTests: [{ name: 'T2', action: 'post_review', input: {}, expect: {} }],
    },
  ],
};

const SOURCE_WITH_FE: LabSourceResponse = {
  lab_id: '01-sqli',
  vulnerable: {
    code: 'async def login(payload, db):\n    sql = f"SELECT *"\n    return sql',
    steps: { 'build-query': 2 },
    line_count: 3,
  },
  secure: {
    code: 'async def login(payload, db):\n    sql = "SELECT $1"\n    return sql',
    steps: { 'build-query': 2 },
    line_count: 3,
  },
  frontend: {
    code: 'export function LabView() {\n  return <form />;\n}',
    steps: { 'fe-submit': 2 },
    line_count: 3,
  },
  diff: '--- vulnerable.py\n+++ secure.py\n@@ -2 +2 @@\n-old\n+new\n',
};

const SOURCE_LAB_TWO: LabSourceResponse = {
  lab_id: '02-xss',
  vulnerable: {
    code: 'async def post_review(payload, db):\n    return {}',
    steps: {},
    line_count: 2,
  },
  secure: { code: 'async def post_review(payload, db):\n    return {}', steps: {}, line_count: 2 },
  frontend: null,
  diff: '',
};

const RUNTIME_ERR_EXEC: LabExecutionResponse = {
  ok: false,
  data: { error: 'SyntaxError: invalid syntax' },
  meta: { lab_id: '01-sqli', mode: 'vulnerable', outcome: 'error' },
  trace: [
    {
      step: 1,
      layer: 'backend',
      tag: 'runtime-error',
      status: 'danger',
      title: 'Lỗi thực thi (SyntaxError)',
      detail: 'SyntaxError: invalid syntax',
    },
  ],
};

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    blob: async () => new Blob(['zip-bytes']),
  } as unknown as Response;
}

describe('VVWA Workspace advanced flows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows manual tab switching during active trace, escapes Diff via FlowPipeline, renders runtime-error, downloads ZIP, and resets GenericRunner across labs', async () => {
    const createUrlSpy = vi.fn(() => 'blob:mock-zip');
    const revokeUrlSpy = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrlSpy, revokeObjectURL: revokeUrlSpy });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/health') return okJson(HEALTH);
        if (url === '/api/labs') return okJson(TWO_LABS);
        if (url === '/api/labs/01-sqli/source') return okJson(SOURCE_WITH_FE);
        if (url === '/api/labs/02-xss/source') return okJson(SOURCE_LAB_TWO);
        if (url === '/api/labs/01-sqli/vulnerable/login') return okJson(RUNTIME_ERR_EXEC);
        if (url === '/api/labs/01-sqli/download') return okJson({});
        return okJson({});
      }),
    );

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lab 01 SQLi' })).toBeInTheDocument();

    // Execute action that returns unmapped runtime-error tag -> top alert renders
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('SyntaxError: invalid syntax');

    // Manual tab switching to Frontend (.tsx) must NOT snap back to Backend (.py)
    const feTab = screen.getByRole('tab', { name: 'Frontend (.tsx)' });
    fireEvent.click(feTab);
    expect(feTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Diff tab, then click FastAPI pipeline node -> must escape Diff back to Backend
    fireEvent.click(screen.getByRole('tab', { name: 'Diff' }));
    expect(screen.getByText('@@ -2 +2 @@')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2\. FastAPI/ }));
    expect(screen.getByRole('tab', { name: 'Backend (.py)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Download ZIP triggers Blob download and notice
    fireEvent.click(screen.getByRole('button', { name: 'Tải Snippet' }));
    expect(await screen.findByText(/Đã tải gói 01-sqli-fastapi\.zip/)).toBeInTheDocument();
    expect(createUrlSpy).toHaveBeenCalledTimes(1);

    // Switch to Lab 02 -> GenericRunnerView actionName must reset from 'login' to 'post_review'
    fireEvent.change(screen.getByLabelText('Chọn bài lab'), { target: { value: '02-xss' } });
    expect(await screen.findByRole('heading', { name: 'Lab 02 XSS' })).toBeInTheDocument();
    await waitFor(() => {
      expect((screen.getByLabelText(/Tên hàm Action/) as HTMLInputElement).value).toBe(
        'post_review',
      );
    });
  });
});
