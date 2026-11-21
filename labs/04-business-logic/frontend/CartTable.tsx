import type { JSX } from 'react';
import { Info, Trash2 } from 'lucide-react';

import { Tooltip } from '@/components';

import { formatMoney } from './cartData';
import type { Product } from './cartData';
import { lineFlags, lineTotal } from './cartForm';
import type { CartLine } from './cartForm';

interface CartTableProps {
  lines: readonly CartLine[];
  products: readonly Product[];
  disabled: boolean;
  onChange: (next: CartLine[]) => void;
}

const INPUT_CLASS =
  'w-16 rounded border bg-white px-1.5 py-1 text-right text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-200';

/**
 * Editable cart of the MiniShop checkout page.
 *
 * The unit price is a form field the browser sends with the order, the way a hidden
 * input would; it is shown here so the request can be tampered with in the sandbox.
 *
 * @param props - Cart lines, catalog, and change handler.
 * @returns Cart table, or an empty-cart notice.
 */
export function CartTable({ lines, products, disabled, onChange }: CartTableProps): JSX.Element {
  if (lines.length === 0) {
    return (
      <p className="text-xs text-slate-500">Giỏ hàng trống. Thêm sản phẩm ở danh sách trên.</p>
    );
  }
  const update = (index: number, patch: Partial<CartLine>): void => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };
  const remove = (index: number): void => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <table className="w-full text-xs text-slate-700">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="py-1 font-medium">Sản phẩm</th>
          <th className="py-1 text-right font-medium">
            <span className="inline-flex items-center justify-end gap-1">
              <span>Đơn giá gửi lên</span>
              <Tooltip tip="Gửi kèm đơn hàng như một input ẩn">
                <button
                  type="button"
                  aria-label="Giải thích đơn giá gửi lên"
                  className="inline-flex cursor-pointer items-center rounded text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <Info className="h-3 w-3" aria-hidden="true" />
                </button>
              </Tooltip>
            </span>
          </th>
          <th className="py-1 text-right font-medium">SL</th>
          <th className="py-1 text-right font-medium">Thành tiền</th>
          <th className="w-6" aria-label="Xóa" />
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          const name = product?.name ?? `Sản phẩm #${String(line.productId)}`;
          const flags = lineFlags(line, product);
          const total = lineTotal(line);
          return (
            <tr
              key={`${String(index)}-${String(line.productId)}`}
              className="border-t border-slate-100"
            >
              <td className="py-1.5 pr-2">
                <span className="block text-slate-900">{name}</span>
                {flags.listedPrice !== null && (
                  <span className="text-xs text-danger-600">
                    Niêm yết {formatMoney(flags.listedPrice)}
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right">
                <input
                  type="number"
                  step="0.01"
                  aria-label={`Đơn giá gửi lên của ${name}`}
                  value={line.price}
                  disabled={disabled}
                  onChange={(event) => update(index, { price: event.target.value })}
                  className={`${INPUT_CLASS} ${flags.priceBad ? 'border-danger-400' : 'border-slate-300'}`}
                />
              </td>
              <td className="py-1.5 text-right">
                <input
                  type="number"
                  aria-label={`Số lượng ${name}`}
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                  className={`${INPUT_CLASS} ${flags.quantityBad ? 'border-danger-400' : 'border-slate-300'}`}
                />
              </td>
              <td className="py-1.5 text-right font-semibold text-slate-900">
                {total === null ? '—' : formatMoney(total)}
              </td>
              <td className="py-1.5 text-right">
                <button
                  type="button"
                  aria-label={`Xóa ${name}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="cursor-pointer text-slate-400 hover:text-danger-600 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
