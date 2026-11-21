import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { ActorSwitcher } from '@/components';
import { useLabActor } from '@/hooks';
import { ACTOR_HEADER, executeLabAction } from '@/lib';
import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabMetadata,
  LabSourceResponse,
} from '@/types';

const HEALTH: HealthResponse = {
  status: 'ok',
  service: 'VVWA API',
  version: '0.1.0',
  environment: 'test',
};

const IDOR_LAB: LabMetadata = {
  id: '03-idor',
  title: 'Lab 03 IDOR',
  category: 'Access Control',
  difficulty: 'Cơ bản',
  summary: 'Order IDOR lab.',
  safetyPattern: 'Check ctx.actor ownership.',
  actors: ['alice', 'bob'],
  samplePayloads: [
    { label: 'Đơn của alice', description: 'Own order', data: { order_id: 1 } },
    { label: 'Xem đơn người khác', description: 'IDOR', data: { order_id: 1 }, actor: 'bob' },
  ],
  verifyTests: [{ name: 'T', action: 'view_order', input: {}, expect: {} }],
};

const PLAIN_LAB: LabMetadata = {
  id: '01-plain',
  title: 'Lab 01 Plain',
  category: 'Injection',
  difficulty: 'Cơ bản',
  summary: 'No session needed.',
  safetyPattern: 'n/a',
  samplePayloads: [],
  verifyTests: [{ name: 'T', action: 'login', input: {}, expect: {} }],
};

const LABS: LabListResponse = { labs: [IDOR_LAB, PLAIN_LAB] };

const EXEC_OK: LabExecutionResponse = {
  ok: true,
  data: {},
  meta: { lab_id: '03-idor', mode: 'vulnerable', outcome: 'normal' },
  trace: [],
};

function sourceFor(labId: string): LabSourceResponse {
  const file = {
    code: 'async def view_order(payload, db, ctx):\n    return {}',
    steps: {},
    line_count: 2,
  };
  return { lab_id: labId, vulnerable: file, secure: file, frontend: null, diff: '' };
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const RESPONSE_PANEL = 'Phản hồi từ hệ thống';

function errJson(status: number, detail: string): Response {
  return { ok: false, status, json: async () => ({ detail }) } as unknown as Response;
}

function stubWorkspaceFetch(exec: FetchFn): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<FetchFn>(async (url, init) => {
      if (url === '/api/health') return okJson(HEALTH);
      if (url === '/api/labs') return okJson(LABS);
      if (url.endsWith('/source')) return okJson(sourceFor(url.split('/')[3] ?? ''));
      if (url.includes('/vulnerable/')) return exec(url, init);
      return okJson({});
    }),
  );
}

function sendButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Gửi yêu cầu' });
}

function StatefulSwitcher(): JSX.Element | null {
  const [actor, setActor] = useState<string>('alice');
  return (
    <ActorSwitcher
      actors={['alice', 'bob', 'admin']}
      actor={actor}
      disabled={false}
      onChange={setActor}
    />
  );
}

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function actorHeaderOf(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.[ACTOR_HEADER];
}

describe('ADR-0005 session actor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the selected persona as X-VVWA-Actor, switches via payload chips, and hides the picker for labs without actors', async () => {
    const fetchMock = vi.fn<FetchFn>(async (url) => {
      if (url === '/api/health') return okJson(HEALTH);
      if (url === '/api/labs') return okJson(LABS);
      if (url.endsWith('/source')) return okJson(sourceFor(url.split('/')[3] ?? ''));
      if (url.includes('/vulnerable/')) return okJson(EXEC_OK);
      return okJson({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const execCalls = (): Parameters<FetchFn>[] =>
      fetchMock.mock.calls.filter(([url]) => url.includes('/vulnerable/'));

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lab 03 IDOR' })).toBeInTheDocument();

    const group = screen.getByRole('radiogroup', { name: 'Đang đăng nhập với tư cách' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'alice' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => {
      expect(execCalls()).toHaveLength(1);
    });
    expect(actorHeaderOf(execCalls()[0]?.[1])).toBe('alice');
    expect(execCalls()[0]?.[1]?.body).not.toContain('alice');

    fireEvent.click(screen.getByRole('button', { name: /Xem đơn người khác/ }));
    expect(screen.getByRole('radio', { name: 'bob' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => {
      expect(execCalls()).toHaveLength(2);
    });
    expect(actorHeaderOf(execCalls()[1]?.[1])).toBe('bob');

    fireEvent.change(screen.getByLabelText('Chọn bài lab'), { target: { value: '01-plain' } });
    expect(await screen.findByRole('heading', { name: 'Lab 01 Plain' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Đang đăng nhập với tư cách' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => {
      expect(execCalls()).toHaveLength(3);
    });
    expect(actorHeaderOf(execCalls()[2]?.[1])).toBeUndefined();
  });

  it('omits the session header when no actor is given', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okJson(EXEC_OK));
    vi.stubGlobal('fetch', fetchMock);
    await executeLabAction('01-plain', 'secure', 'login', { a: 1 });
    expect(actorHeaderOf(fetchMock.mock.calls[0]?.[1])).toBeUndefined();
  });

  it('defaults to the first actor, ignores undeclared names, and resets when the lab changes', () => {
    const { result, rerender } = renderHook(({ lab }) => useLabActor(lab), {
      initialProps: { lab: IDOR_LAB as LabMetadata | null },
    });
    expect(result.current.actor).toBe('alice');

    act(() => {
      result.current.setActor('mallory');
    });
    expect(result.current.actor).toBe('alice');

    act(() => {
      result.current.setActor('bob');
    });
    expect(result.current.actor).toBe('bob');

    rerender({ lab: PLAIN_LAB });
    expect(result.current.actor).toBeNull();
    rerender({ lab: IDOR_LAB });
    expect(result.current.actor).toBe('alice');
  });

  it('keeps the response when re-clicking the active persona and clears response and notice on a real persona change', async () => {
    let failNext = false;
    stubWorkspaceFetch(async () =>
      failNext ? errJson(400, 'Unknown actor bob') : okJson(EXEC_OK),
    );
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lab 03 IDOR' })).toBeInTheDocument();

    fireEvent.click(sendButton());
    expect(await screen.findByText(RESPONSE_PANEL)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'alice' }));
    expect(screen.getByText(RESPONSE_PANEL)).toBeInTheDocument();

    // A sample chip that switches persona must not leave alice's result on screen.
    fireEvent.click(screen.getByRole('button', { name: /Xem đơn người khác/ }));
    expect(screen.getByRole('radio', { name: 'bob' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(RESPONSE_PANEL)).toBeNull();

    failNext = true;
    fireEvent.click(sendButton());
    expect(await screen.findByText('Unknown actor bob')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'alice' }));
    expect(screen.queryByText('Unknown actor bob')).toBeNull();
  });

  it('drops a response that arrives after the persona changed mid-flight', async () => {
    let release: (resp: Response) => void = () => undefined;
    stubWorkspaceFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lab 03 IDOR' })).toBeInTheDocument();

    fireEvent.click(sendButton());
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'alice' })).toBeDisabled();
    });
    // The switcher is disabled while executing, but a persona chip can still change it.
    fireEvent.click(screen.getByRole('button', { name: /Xem đơn người khác/ }));
    await act(async () => {
      release(okJson(EXEC_OK));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'bob' })).toBeEnabled();
    });
    expect(screen.queryByText(RESPONSE_PANEL)).toBeNull();
  });

  it('follows the WAI-ARIA radio group keyboard pattern with a single tab stop', () => {
    render(<StatefulSwitcher />);
    const radio = (name: string): HTMLElement => screen.getByRole('radio', { name });
    expect(radio('alice')).toHaveAttribute('tabindex', '0');
    expect(radio('bob')).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(radio('alice'), { key: 'ArrowRight' });
    expect(radio('bob')).toHaveAttribute('aria-checked', 'true');
    expect(radio('bob')).toHaveFocus();
    expect(radio('bob')).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(radio('bob'), { key: 'End' });
    expect(radio('admin')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('admin'), { key: 'ArrowDown' });
    expect(radio('alice')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('alice'), { key: 'ArrowLeft' });
    expect(radio('admin')).toHaveFocus();
  });
});
