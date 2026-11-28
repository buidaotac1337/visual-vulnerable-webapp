import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/08-race-condition/frontend/LabView';
import {
  buildRenderSteps,
  summarizeBurst,
} from '../../../../labs/08-race-condition/frontend/couponData';

const LAB_08_META: LabMetadata = {
  id: '08-race-condition',
  title: 'Race Condition — Áp mã giảm giá MiniShop',
  category: 'Business Logic',
  difficulty: 'Trung bình',
  summary: 'Race condition demo.',
  safetyPattern: 'Use db.transaction() and SELECT ... FOR UPDATE.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['alice', 'bob'],
};

const COUPON_CATALOG = {
  coupons: [
    { id: 1, code: 'WELCOME10', discount_percent: 10, max_uses: 1, used_count: 0 },
    { id: 2, code: 'STUDENT20', discount_percent: 20, max_uses: 5, used_count: 0 },
  ],
  balance: 500,
};

function makeResponse(
  data: Record<string, unknown>,
  outcome: 'normal' | 'exploited' | 'blocked' | 'error' = 'normal',
  ok = true,
): LabExecutionResponse {
  return {
    ok,
    data,
    meta: { lab_id: '08-race-condition', mode: 'vulnerable', outcome },
    trace: [],
  };
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_08_META,
    mode: 'vulnerable',
    actor: 'alice',
    payload: { code: 'WELCOME10', burst: 1 },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async (action) =>
      action === 'load_coupons'
        ? makeResponse(COUPON_CATALOG)
        : makeResponse({
            applied: true,
            code: 'WELCOME10',
            discount_percent: 10,
            bonus: 10,
            used_count: 1,
            max_uses: 1,
            over_limit: false,
            balance: 510,
            error: null,
          }),
    ),
    ...overrides,
  };
}

describe('Lab 08 Race Condition LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('08-race-condition')).toBe(true);
    expect(await loadFrontendSinkModule('08-race-condition')).toBeNull();
  });

  it('loads coupons and dispatches a single apply_coupon request with trace steps', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('load_coupons', {}, { silent: true });
    expect(await screen.findByText('WELCOME10')).toBeTruthy();
    expect(screen.getByText('$500.00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Áp mã' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Áp mã giảm giá thành công');
    });

    const call = vi.mocked(props.onExecute).mock.calls.find(([a]) => a === 'apply_coupon');
    expect(call?.[1]).toEqual({ code: 'WELCOME10' });
    const options = call?.[2] as ExecuteActionOptions;
    expect(options.silent).toBeUndefined();
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({ tag: 'fe-send-burst' }),
    );
    expect(
      options.frontendStepsAfter?.(
        makeResponse(
          { applied: true, code: 'WELCOME10', used_count: 2, max_uses: 1, over_limit: true },
          'exploited',
        ),
      ),
    ).toEqual([expect.objectContaining({ tag: 'fe-render-burst', status: 'danger' })]);
  });

  it('fires N-1 silent + 1 traced parallel requests on burst > 1 and renders danger alert on over_limit', async () => {
    let seq = 0;
    const onExecute = vi.fn<LabViewProps['onExecute']>(async (action) => {
      if (action === 'load_coupons') {
        return makeResponse({
          coupons: [
            { id: 1, code: 'WELCOME10', discount_percent: 10, max_uses: 1, used_count: seq },
          ],
          balance: 500 + seq * 10,
        });
      }
      seq += 1;
      return makeResponse(
        {
          applied: true,
          code: 'WELCOME10',
          bonus: 10,
          used_count: seq,
          max_uses: 1,
          over_limit: seq > 1,
          balance: 500 + seq * 10,
          error: null,
        },
        seq > 1 ? 'exploited' : 'normal',
      );
    });

    render(<LabView {...makeProps({ payload: { code: 'WELCOME10', burst: 5 }, onExecute })} />);
    await screen.findByText('WELCOME10');

    fireEvent.click(screen.getByRole('button', { name: 'Bắn đồng thời 5 request' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Phát hiện Race Condition');
    expect(alert).toHaveTextContent('5/5 request áp mã WELCOME10 đã thành công đồng thời');
    // The badge comes from the coupon reload that follows the burst, so wait for it.
    expect(await screen.findByText('Vượt giới hạn!')).toBeTruthy();

    const applyCalls = vi.mocked(onExecute).mock.calls.filter(([a]) => a === 'apply_coupon');
    expect(applyCalls).toHaveLength(5);
    expect(applyCalls.slice(0, 4).every(([, , opts]) => opts?.silent === true)).toBe(true);
    expect(applyCalls[4]?.[2]?.frontendStepsBefore?.[0]?.tag).toBe('fe-send-burst');
  });

  it('renders safe notice when secure mode blocks excess concurrent requests', async () => {
    let callIdx = 0;
    const onExecute = vi.fn<LabViewProps['onExecute']>(async (action) => {
      if (action === 'load_coupons') {
        return makeResponse(COUPON_CATALOG);
      }
      callIdx += 1;
      if (callIdx === 1) {
        return makeResponse({
          applied: true,
          code: 'WELCOME10',
          bonus: 10,
          used_count: 1,
          max_uses: 1,
          over_limit: false,
          balance: 510,
          error: null,
        });
      }
      return makeResponse(
        {
          applied: false,
          code: 'WELCOME10',
          bonus: 0,
          used_count: null,
          max_uses: null,
          over_limit: false,
          balance: null,
          error: "Mã 'WELCOME10' đã hết lượt sử dụng.",
        },
        'blocked',
      );
    });

    render(
      <LabView
        {...makeProps({ mode: 'secure', payload: { code: 'WELCOME10', burst: 5 }, onExecute })}
      />,
    );
    await screen.findByText('WELCOME10');

    fireEvent.click(screen.getByRole('button', { name: 'Bắn đồng thời 5 request' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã chặn Race Condition an toàn');
    expect(status).toHaveTextContent('1/5 request hợp lệ và chặn gọn 4 request dư');
  });

  it('updates coupon code and burst count controls and summarizes edge cases cleanly', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ onPayloadChange })} />);
    await screen.findByText('STUDENT20');

    fireEvent.click(screen.getByText('STUDENT20'));
    expect(onPayloadChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'STUDENT20' }),
    );

    fireEvent.change(screen.getByLabelText('Số request đồng thời'), { target: { value: '8' } });
    expect(onPayloadChange).toHaveBeenLastCalledWith(expect.objectContaining({ burst: 8 }));

    expect(buildRenderSteps(makeResponse({ error: 'x' }, 'error', false), 1)).toEqual([]);
    const nullBurst = summarizeBurst([null], 'WELCOME10', 1);
    expect(nullBurst.errors).toBe(1);
    expect(nullBurst.overLimit).toBe(false);
  });
});
