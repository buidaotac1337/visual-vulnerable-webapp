import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ShoppingCart } from 'lucide-react';

import type { LabViewProps } from '@/types';

import { CartTable } from './CartTable';
import { CheckoutSummary } from './CheckoutSummary';
import { buildRenderSteps, formatMoney, readCheckout, readShop } from './cartData';
import type { Product, ShopData } from './cartData';
import { clientSubtotal, isValidQuantity, readCart, toRequestItems, writeCart } from './cartForm';
import type { CartLine, RequestItem } from './cartForm';

const LAB_ID = '04-business-logic';

/** Reload the catalog and balance silently on persona, mode, reset, or after each placed order. */
function useShop(props: LabViewProps): ShopData {
  const { actor, mode, dbResetSeq, lastResponse, onExecute } = props;
  // Only a placed order changes the balance. Remember the last one, so a later rejected
  // checkout (or a cleared response) does not count as a change and reload again.
  const placedRef = useRef<number | null>(null);
  const placedId = readCheckout(lastResponse?.data)?.orderId ?? null;
  if (placedId !== null) {
    placedRef.current = placedId;
  }
  const placedOrderId = placedRef.current;
  const [shop, setShop] = useState<ShopData>({ products: [], balance: null });
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef.current('load_shop', {}, { silent: true }).then((response) => {
      // Keep the last good catalog if a silent reload fails.
      if (active && response?.ok) {
        setShop(readShop(response.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq, placedOrderId]);

  return shop;
}

/** One more unit than typed, or 1 when the typed quantity is not a whole number. */
function nextQuantity(text: string): number {
  return isValidQuantity(text) ? Number(text) + 1 : 1;
}

/** Add one unit of a product, with its catalog price, to the cart. */
function addToCart(lines: readonly CartLine[], product: Product): CartLine[] {
  const index = lines.findIndex((line) => line.productId === product.id);
  if (index < 0) {
    return [...lines, { productId: product.id, quantity: '1', price: String(product.price) }];
  }
  return lines.map((line, i) =>
    i === index ? { ...line, quantity: String(nextQuantity(line.quantity)) } : line,
  );
}

/**
 * Interactive MiniShop cart and checkout page for Lab 04 (business logic flaw).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered catalog, cart, and checkout result.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const shop = useShop(props);
  const lines = readCart(payload);
  const items = toRequestItems(lines);
  const result = readCheckout(lastResponse?.data);
  const setLines = (next: CartLine[]): void =>
    onPayloadChange({ ...payload, items: writeCart(next) });

  // @snippet:start
  const checkout = (body: RequestItem[]): void => {
    // @step:fe-submit-cart
    void props.onExecute(
      'checkout',
      { items: body },
      {
        frontendStepsBefore: [
          {
            layer: 'frontend',
            tag: 'fe-submit-cart',
            status: 'info',
            title: `Gửi giỏ hàng ${String(body.length)} món, tạm tính ${formatMoney(clientSubtotal(body))}`,
            detail: `POST /api/labs/${LAB_ID}/${mode}/checkout ${JSON.stringify({ items: body })}`,
          },
        ],
        // @step:fe-render-result
        frontendStepsAfter: (response) => buildRenderSteps(response, shop.products),
      },
    );
  };
  // @snippet:end

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShoppingCart className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span>MiniShop · Giỏ hàng</span>
        </div>
        <span className="text-xs text-slate-500">
          {actor ?? 'ẩn danh'} · Số dư:{' '}
          <strong className="text-slate-900">
            {shop.balance === null ? '—' : formatMoney(shop.balance)}
          </strong>
        </span>
      </div>

      <section aria-label="Sản phẩm" className="grid gap-1.5 sm:grid-cols-3">
        {shop.products.map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={isExecuting}
            onClick={() => setLines(addToCart(lines, product))}
            className="flex cursor-pointer flex-col items-start rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50/50 disabled:cursor-not-allowed"
          >
            <span className="font-semibold text-slate-900">{product.name}</span>
            <span>
              {formatMoney(product.price)} · còn {product.stock} · + Thêm
            </span>
          </button>
        ))}
      </section>

      <section
        key={`cart-${String(inputFlashSeq)}`}
        aria-label="Giỏ hàng"
        className={`flex flex-col gap-2 rounded-lg ${inputFlashSeq > 0 ? 'vvwa-input-flash' : ''}`}
      >
        <CartTable
          lines={lines}
          products={shop.products}
          disabled={isExecuting}
          onChange={setLines}
        />
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">
            Tạm tính (trình duyệt):{' '}
            <strong className="text-slate-900">
              {items ? formatMoney(clientSubtotal(items)) : '—'}
            </strong>
          </span>
          <button
            type="button"
            disabled={isExecuting || items === null}
            onClick={() => items && checkout(items)}
            className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExecuting ? 'Đang thanh toán...' : 'Thanh toán'}
          </button>
        </div>
      </section>

      <CheckoutSummary result={result} products={shop.products} />
    </div>
  );
}
