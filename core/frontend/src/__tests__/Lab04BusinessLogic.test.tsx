import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/04-business-logic/frontend/LabView';
import {
  buildRenderSteps,
  readCart,
  toRequestItems,
} from '../../../../labs/04-business-logic/frontend/cartData';

const LAB_04_META: LabMetadata = {
  id: '04-business-logic',
  title: 'Business Logic — Giỏ hàng & Thanh toán MiniShop',
  category: 'Business Logic',
  difficulty: 'Cơ bản',
  summary: 'Business logic demo.',
  safetyPattern: 'Reprice on the server.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['alice', 'bob'],
};

const PRODUCTS = [
  { id: 1, name: 'Ban phim', price: 89, stock: 25 },
  { id: 2, name: 'Chuot', price: 45, stock: 40 },
  { id: 3, name: 'Tai nghe', price: 120, stock: 15 },
];

function response(data: Record<string, unknown>): LabExecutionResponse {
  return {
    ok: true,
    data,
    meta: { lab_id: '04-business-logic', mode: 'vulnerable', outcome: 'normal' },
    trace: [],
  };
}

function placed(quantity: number, unitPrice: number, balance: number): LabExecutionResponse {
  const item = { product_id: 2, name: 'Chuot', quantity, unit_price: unitPrice };
  const order = { id: 3, total_amount: quantity * unitPrice, items: [item] };
  return response({ placed: true, order, balance, error: null });
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_04_META,
    mode: 'vulnerable',
    actor: 'alice',
    payload: { items: [{ product_id: 3, quantity: 1, price: 1 }] },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => response({ products: PRODUCTS, balance: 500 })),
    ...overrides,
  };
}

describe('Lab 04 Business Logic LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('04-business-logic')).toBe(true);
    expect(await loadFrontendSinkModule('04-business-logic')).toBeNull();
  });

  it('loads the shop silently and sends the cart with its client-side prices', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('load_shop', {}, { silent: true });
    expect(await screen.findByText('$500.00')).toBeTruthy();
    expect(screen.getByText('Niêm yết $120.00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([action]) => action === 'checkout');
    expect(call?.[1]).toEqual({ items: [{ product_id: 3, quantity: 1, price: 1 }] });
    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({
        tag: 'fe-submit-cart',
        title: 'Gửi giỏ hàng 1 món, tạm tính $1.00',
      }),
    );
    const steps = options.frontendStepsAfter?.(placed(-5, 45, 725));
    expect(steps).toEqual([expect.objectContaining({ tag: 'fe-render-result', status: 'danger' })]);
    const cheap = options.frontendStepsAfter?.(placed(1, 1, 499));
    expect(cheap?.[0]?.detail).toBe(
      'Đơn #3, tổng $1.00. Giá niêm yết là $45.00, server đã tính theo đơn giá trình duyệt gửi lên.',
    );
  });

  it('adds catalog products to the cart at their listed price', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ payload: { items: [] }, onPayloadChange })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Chuot/ }));
    expect(onPayloadChange).toHaveBeenLastCalledWith({
      items: [{ product_id: 2, quantity: '1', price: '45' }],
    });
    expect(screen.getByRole('button', { name: 'Thanh toán' })).toBeDisabled();
  });

  it('warns when an order was accepted with a negative total', async () => {
    render(<LabView {...makeProps({ lastResponse: placed(-5, 45, 725) })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Số lượng âm làm tổng tiền âm: số dư được cộng thêm $225.00 thay vì bị trừ.',
    );
    expect(screen.getByText('Đặt hàng thành công: đơn #3, tổng -$225.00')).toBeTruthy();
  });

  it('shows a fair order and a rejection without a warning', async () => {
    const { rerender } = render(<LabView {...makeProps({ lastResponse: placed(2, 45, 410) })} />);
    expect(await screen.findByText('Số dư còn lại: $410.00')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    const error = 'Giỏ hàng không hợp lệ (items.0.quantity): Input should be greater than 0';
    const rejected = response({ placed: false, order: null, balance: null, error });
    await act(async () => {
      rerender(<LabView {...makeProps({ lastResponse: rejected })} />);
    });
    expect(screen.getByText(error)).toBeTruthy();
    expect(buildRenderSteps(rejected, PRODUCTS)).toEqual([
      expect.objectContaining({ status: 'info', title: 'Hiển thị lỗi thanh toán' }),
    ]);
  });

  it('keeps typed values and only checks out numeric carts', () => {
    const lines = readCart({ items: [{ product_id: 1, quantity: '', price: '89' }] });
    expect(lines).toEqual([{ productId: 1, quantity: '', price: '89' }]);
    expect(toRequestItems(lines)).toBeNull();
    expect(toRequestItems([{ productId: 1, quantity: '-2', price: '89.5' }])).toEqual([
      { product_id: 1, quantity: -2, price: 89.5 },
    ]);
    expect(toRequestItems([])).toBeNull();
    const crashed: LabExecutionResponse = { ...response({ error: 'NameError' }), ok: false };
    expect(buildRenderSteps(crashed, PRODUCTS)).toEqual([]);
  });
});
