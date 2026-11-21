import { act, render, renderHook, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VerifyModal } from '@/components';
import { useLabVerify } from '@/hooks';
import type { SinkModule } from '@/lib';
import type { LabMetadata, VerifyLabResponse } from '@/types';

const LAB: LabMetadata = {
  id: '02-xss',
  title: 'Lab 02 XSS',
  category: 'XSS',
  difficulty: 'Cơ bản',
  summary: 'Stored XSS',
  safetyPattern: 'Render as text',
  samplePayloads: [],
  verifyTests: [
    { name: 'Lưu review', action: 'post_review', input: {}, expect: {} },
    {
      name: 'Render an toàn',
      layer: 'frontend',
      component: 'ReviewContent',
      props: { content: '<img src=x onerror=alert(1)>' },
      expect: { activeContent: false },
    },
  ],
};

const BACKEND_REPORT: VerifyLabResponse = {
  ok: true,
  lab_id: '02-xss',
  passed: true,
  total: 1,
  passed_count: 1,
  results: [
    {
      name: 'Lưu review',
      action: 'post_review',
      layer: 'backend',
      passed: true,
      expected: {},
      actual: {},
      error: null,
    },
  ],
};

function SafeReview({ content }: { content: string }): JSX.Element {
  return <p>{content}</p>;
}

const SINK: SinkModule = { ReviewContent: SafeReview };

function stubVerifyFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function setup(
  lab: LabMetadata = LAB,
): ReturnType<typeof renderHook<ReturnType<typeof useLabVerify>, unknown>> {
  const setDbResetSeq = vi.fn();
  return renderHook(() =>
    useLabVerify({
      selectedLab: lab,
      activeCtxRef: { current: { labId: lab.id } },
      refreshSource: async () => undefined,
      setDbResetSeq,
      loadSink: async () => SINK,
    }),
  );
}

describe('useLabVerify (ADR-0006)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs backend and frontend tests and merges them into one passing report', async () => {
    const fetchMock = stubVerifyFetch({
      ok: true,
      status: 200,
      json: async () => BACKEND_REPORT,
    } as unknown as Response);
    const { result } = setup();
    await act(async () => {
      await result.current.handleVerify();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.verifyError).toBeNull();
    expect(result.current.verifyResult).toMatchObject({ passed: true, total: 2, passed_count: 2 });
    expect(result.current.verifyResult?.results.map((r) => r.layer)).toEqual([
      'backend',
      'frontend',
    ]);
    expect(result.current.isVerifying).toBe(false);
  });

  it('keeps frontend results and fails the report when the backend request errors', async () => {
    stubVerifyFetch({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'DB offline' }),
    } as unknown as Response);
    const { result } = setup();
    await act(async () => {
      await result.current.handleVerify();
    });
    expect(result.current.verifyError).toBe('DB offline');
    expect(result.current.verifyResult).toMatchObject({ passed: false, total: 1, passed_count: 1 });
  });

  it('skips the backend call for labs with only frontend tests', async () => {
    const fetchMock = stubVerifyFetch({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);
    const { result } = setup({ ...LAB, verifyTests: LAB.verifyTests.slice(1) });
    await act(async () => {
      await result.current.handleVerify();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.verifyResult).toMatchObject({ passed: true, total: 1 });
  });
});

describe('VerifyModal layers', () => {
  it('labels each result with its layer and shows a backend error next to frontend results', () => {
    render(
      <VerifyModal
        isOpen
        labTitle="Lab 02 XSS"
        isLoading={false}
        error="DB offline"
        result={{
          ok: false,
          lab_id: '02-xss',
          passed: false,
          total: 1,
          passed_count: 1,
          results: [
            {
              name: 'Render an toàn',
              action: 'ReviewContent',
              layer: 'frontend',
              passed: true,
              expected: {},
              actual: {},
              error: null,
            },
          ],
        }}
        onRerun={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('<ReviewContent />')).toBeInTheDocument();
    expect(screen.getByText(/Không chạy được kiểm thử backend: DB offline/)).toBeInTheDocument();
  });
});
