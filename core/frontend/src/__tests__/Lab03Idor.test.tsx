import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/03-idor/frontend/LabView';

const LAB_03_META: LabMetadata = {
  id: '03-idor',
  title: 'IDOR — Xem chi tiết đơn hàng MiniShop',
  category: 'Access Control',
  difficulty: 'Cơ bản',
  summary: 'IDOR demo.',
  safetyPattern: 'Scope by ctx.actor.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['alice', 'bob'],
};

const BOB_ORDER = {
  id: 2,
  owner: 'bob',
  status: 'shipped',
  total_amount: 120,
  shipping_address: '456 Pho Hue',
  created_at: '2026-11-20T00:00:00+00:00',
  items: [{ name: 'Tai nghe', quantity: 1, unit_price: 120 }],
};

function response(data: Record<string, unknown>): LabExecutionResponse {
  return {
    ok: true,
    data,
    meta: { lab_id: '03-idor', mode: 'vulnerable', outcome: 'normal' },
    trace: [],
  };
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_03_META,
    mode: 'vulnerable',
    actor: 'alice',
    payload: { order_id: 2 },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () =>
      response({ orders: [{ id: 1, status: 'paid', total_amount: 89 }], count: 1 }),
    ),
    ...overrides,
  };
}

describe('Lab 03 IDOR LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('03-idor')).toBe(true);
    expect(await loadFrontendSinkModule('03-idor')).toBeNull();
  });

  it('loads my orders silently and opens an order from the address bar', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('list_orders', {}, { silent: true });
    expect(await screen.findByText('Đơn #1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mở đơn' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([action]) => action === 'view_order');
    expect(call?.[1]).toEqual({ order_id: 2 });
    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({ tag: 'fe-open-order', title: 'Mở trang /orders/2' }),
    );

    const foreign = options.frontendStepsAfter?.(response({ found: true, order: BOB_ORDER }));
    expect(foreign).toEqual([
      expect.objectContaining({ tag: 'fe-render-order', status: 'danger' }),
    ]);
    const missing = options.frontendStepsAfter?.(
      response({ found: false, order: null, error: 'Không tìm thấy đơn hàng #2.' }),
    );
    expect(missing).toEqual([expect.objectContaining({ status: 'info' })]);
  });

  it('warns when the shown order belongs to another customer', async () => {
    render(
      <LabView {...makeProps({ lastResponse: response({ found: true, order: BOB_ORDER }) })} />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Đây là đơn của bob');
    expect(screen.getByText('456 Pho Hue')).toBeTruthy();
  });

  it('shows the not-found message for denied lookups', async () => {
    render(
      <LabView
        {...makeProps({
          lastResponse: response({
            found: false,
            order: null,
            error: 'Không tìm thấy đơn hàng #2.',
          }),
        })}
      />,
    );
    expect(await screen.findByText('Không tìm thấy đơn hàng #2.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
