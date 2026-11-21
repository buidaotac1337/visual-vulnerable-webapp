import type { JSX } from 'react';
import { AlertTriangle, UserCheck } from 'lucide-react';

import { ResultNotice } from '@/components';
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
    <ResultNotice tone="warning" title="Lỗi cú pháp SQL (Error-based SQLi)">
      <p className="break-all text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
        {message}
      </p>
    </ResultNotice>
  );
}

/** Indexes of rows the backend flagged as not being real products (data pulled in by SQLi). */
function readLeakedRows(response: LabExecutionResponse | null): Set<number> {
  const raw = response?.data.leaked_rows;
  return new Set(Array.isArray(raw) ? raw.filter((i): i is number => typeof i === 'number') : []);
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
      <ResultNotice tone="neutral">Đăng nhập thất bại — sai tài khoản hoặc mật khẩu.</ResultNotice>
    );
  }
  const isExploited = response.meta.outcome === 'exploited';
  // The welcome card stays neutral: a successful login is not an error. What went wrong is
  // said separately, in words, when the login was a bypass.
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800">
        <div className="flex items-center justify-between gap-2 font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-safe-600" aria-hidden="true" />
            Chào mừng {user.username}!
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase">
            {user.role}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Email: {user.email} · Số dư ví MiniShop: ${user.balance.toFixed(2)}
        </p>
      </div>
      {isExploited && (
        <ResultNotice
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />}
        >
          Đăng nhập vào tài khoản {user.username} mà không cần mật khẩu đúng: payload đã thay đổi
          điều kiện WHERE của câu truy vấn đăng nhập.
        </ResultNotice>
      )}
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
    return <ResultNotice tone="neutral">Không tìm thấy sản phẩm nào khớp từ khóa.</ResultNotice>;
  }
  const leaked = readLeakedRows(response);
  return (
    <div className="flex flex-col gap-2">
      {leaked.size > 0 && (
        <ResultNotice
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />}
        >
          {leaked.size} dòng bên dưới không phải sản phẩm: dữ liệu từ bảng hoặc truy vấn khác bị kéo
          ra qua UNION SELECT.
        </ResultNotice>
      )}
      {products.map((item, idx) => {
        const isLeakedRow = leaked.has(idx);
        return (
          <div
            key={`${idx}-${item.id}-${item.name}`}
            className={`rounded-lg border p-2.5 text-xs ${
              isLeakedRow
                ? 'border-danger-300 bg-danger-50 text-danger-900'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>{item.name}</span>
              <span>${item.price.toFixed(2)}</span>
            </div>
            <p
              className={`mt-0.5 break-all text-xs ${isLeakedRow ? 'text-danger-800' : 'text-slate-600'}`}
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
