import type { JSX } from 'react';
import { AlertTriangle, UserCheck } from 'lucide-react';

import type { LabExecutionResponse } from '@/types';

interface UserRecord {
  username: string;
  email: string;
  role: string;
  balance: number;
}

interface ProductRecord {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

function readSqlError(response: LabExecutionResponse | null): string | null {
  const err = response?.data.sql_error;
  return typeof err === 'string' && err.length > 0 ? err : null;
}

function renderSqlErrorBanner(message: string): JSX.Element {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span>Lỗi cú pháp SQL (Error-based SQLi)</span>
      </div>
      <p className="mt-1 break-all text-[11px]" style={{ fontFamily: 'var(--font-mono)' }}>
        {message}
      </p>
    </div>
  );
}

function parseUserRecord(response: LabExecutionResponse | null): UserRecord | null {
  const raw = response?.data.user;
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.username !== 'string') {
    return null;
  }
  return {
    username: obj.username,
    email: typeof obj.email === 'string' ? obj.email : '',
    role: typeof obj.role === 'string' ? obj.role : 'customer',
    balance: typeof obj.balance === 'number' ? obj.balance : 0,
  };
}

function parseProductList(response: LabExecutionResponse | null): ProductRecord[] | null {
  const raw = response?.data.products;
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, idx) => ({
      id: typeof item.id === 'number' ? item.id : idx + 1,
      name: typeof item.name === 'string' ? item.name : '',
      description: typeof item.description === 'string' ? item.description : '',
      price: typeof item.price === 'number' ? item.price : 0,
      stock: typeof item.stock === 'number' ? item.stock : 0,
    }));
}

/**
 * Render the MiniShop login outcome banner (SQL error, welcome card, or auth failure).
 *
 * @param props - Last execution response returned by the login action.
 * @returns Rendered login feedback card, or null if unrelated.
 */
export function LoginResultCard({
  response,
}: {
  response: LabExecutionResponse | null;
}): JSX.Element | null {
  if (!response || !('logged_in' in response.data)) {
    return null;
  }
  const sqlError = readSqlError(response);
  if (sqlError) {
    return renderSqlErrorBanner(sqlError);
  }
  const user = parseUserRecord(response);
  if (!user) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Đăng nhập thất bại — sai tài khoản hoặc mật khẩu.
      </div>
    );
  }
  const isExploited = response.meta.outcome === 'exploited';
  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        isExploited
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          Chào mừng {user.username}!
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase">
          {user.role}
        </span>
      </div>
      <p className="mt-1 text-[11px] opacity-85">
        Email: {user.email} · Số dư ví MiniShop: ${user.balance.toFixed(2)}
      </p>
    </div>
  );
}

/**
 * Render matched MiniShop product rows, SQL syntax errors, or leaked UNION rows.
 *
 * @param props - Last execution response returned by the search_products action.
 * @returns Rendered product search results list, or null if unrelated.
 */
export function SearchResultList({
  response,
}: {
  response: LabExecutionResponse | null;
}): JSX.Element | null {
  const products = parseProductList(response);
  if (products === null) {
    return null;
  }
  const sqlError = readSqlError(response);
  if (sqlError) {
    return renderSqlErrorBanner(sqlError);
  }
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Không tìm thấy sản phẩm nào khớp từ khóa.
      </div>
    );
  }
  const isExploited = response?.meta.outcome === 'exploited';
  return (
    <div className="flex flex-col gap-2">
      {products.map((item, idx) => {
        const isLeakedRow = (item.description.includes(':') || isExploited) && item.stock === 0;
        return (
          <div
            key={`${idx}-${item.id}-${item.name}`}
            className={`rounded-lg border p-2.5 text-xs ${
              isLeakedRow
                ? 'border-red-300 bg-red-50 text-red-900'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>{item.name}</span>
              <span>${item.price.toFixed(2)}</span>
            </div>
            <p
              className="mt-0.5 break-all text-[11px] opacity-85"
              style={{ fontFamily: isLeakedRow ? 'var(--font-mono)' : undefined }}
            >
              {item.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
