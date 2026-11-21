import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasLabView,
  isFrontendVerifyTest,
  loadFrontendSinkModule,
  runFrontendVerifyTests,
} from '@/lib';
import type { SinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/02-stored-xss/frontend/LabView';
import * as secureSink from '../../../../labs/02-stored-xss/frontend/secure';
import * as vulnerableSink from '../../../../labs/02-stored-xss/frontend/vulnerable';

const rawMeta = Object.values(
  import.meta.glob<string>('../../../../labs/02-stored-xss/meta.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
)[0];
const LAB_02_META = JSON.parse(rawMeta ?? '{}') as LabMetadata;
const FRONTEND_TESTS = LAB_02_META.verifyTests.filter(isFrontendVerifyTest);
const PAYLOAD = '<img src=x onerror=alert(1)>';

function pageResponse(mode: LabMode, content: string): LabExecutionResponse {
  return {
    ok: true,
    data: {
      product_id: 1,
      products: [{ id: 1, name: 'Ban phim co MiniShop K1' }],
      reviews: [{ id: 7, username: 'bob', rating: 1, content }],
      count: 1,
    },
    meta: { lab_id: '02-stored-xss', mode, outcome: 'normal' },
    trace: [],
  };
}

function makeProps(mode: LabMode, overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_02_META,
    mode,
    actor: 'bob',
    payload: { tab: 'write', product_id: 1, rating: 1, content: PAYLOAD },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => pageResponse(mode, PAYLOAD)),
    ...overrides,
  };
}

describe('Lab 02 Stored XSS', () => {
  // The sink analysis and the grader render into their own React roots with flushSync,
  // as in the browser. Testing Library still enables act() around its own render calls.
  const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previousActEnv: boolean | undefined;
  beforeEach(() => {
    previousActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT;
    actEnv.IS_REACT_ACT_ENVIRONMENT = false;
  });
  afterEach(() => {
    actEnv.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
  });

  it('is discovered with a LabView and a complete frontend sink pair', async () => {
    expect(hasLabView('02-stored-xss')).toBe(true);
    const sink = await loadFrontendSinkModule('02-stored-xss');
    expect(sink && typeof sink.ReviewContent).toBe('function');
  });

  it('meta.json frontend tests fail the vulnerable sink and pass the secure sink', async () => {
    expect(FRONTEND_TESTS).toHaveLength(6);
    const vulnerable = await runFrontendVerifyTests(FRONTEND_TESTS, vulnerableSink as SinkModule);
    const secure = await runFrontendVerifyTests(FRONTEND_TESTS, secureSink as SinkModule);

    expect(vulnerable.map((result) => result.passed)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(vulnerable.every((result) => result.error === null)).toBe(true);
    expect(secure.every((result) => result.passed)).toBe(true);
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('loads reviews silently and flags executable markup only in vulnerable mode', async () => {
    const vuln = makeProps('vulnerable');
    const { unmount } = render(<LabView {...vuln} />);
    expect(vuln.onExecute).toHaveBeenCalledWith(
      'list_reviews',
      { product_id: 1 },
      { silent: true },
    );
    expect(
      await screen.findByText(/Nội dung đã thành mã thực thi được: <img onerror>/),
    ).toBeTruthy();
    unmount();

    render(<LabView {...makeProps('secure')} />);
    expect(await screen.findByText(PAYLOAD)).toBeTruthy();
    expect(screen.queryByText(/mã thực thi được/)).toBeNull();
  });

  it('submits post_review and traces the render step from the active sink', async () => {
    for (const [mode, status] of [
      ['vulnerable', 'danger'],
      ['secure', 'safe'],
    ] as const) {
      const props = makeProps(mode);
      const { unmount } = render(<LabView {...props} />);
      await waitFor(() => expect(screen.getByText('bob')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));

      const call = vi
        .mocked(props.onExecute)
        .mock.calls.find(([action]) => action === 'post_review');
      expect(call?.[1]).toEqual({ product_id: 1, rating: 1, content: PAYLOAD });
      const options = call?.[2] as ExecuteActionOptions;
      expect(options.frontendStepsBefore?.[0]?.tag).toBe('fe-submit-review');
      const after = options.frontendStepsAfter?.(pageResponse(mode, PAYLOAD)) ?? [];
      expect(after).toEqual([expect.objectContaining({ tag: 'fe-render-review', status })]);
      unmount();
    }
  });
});
