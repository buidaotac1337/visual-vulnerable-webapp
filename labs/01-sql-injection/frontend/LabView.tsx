import type { FormEvent, JSX } from 'react';
import { KeyRound, LogIn, Search, ShoppingBag } from 'lucide-react';

import type { LabPayload, LabViewProps } from '@/types';

import { LoginResultCard, SearchResultList } from './ResultCards';

type SubTab = 'login' | 'search';

function readString(payload: LabPayload, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function resolveSubTab(payload: LabPayload): SubTab {
  if (payload.tab === 'search') {
    return 'search';
  }
  if (payload.tab === 'login') {
    return 'login';
  }
  return 'keyword' in payload && !('username' in payload) ? 'search' : 'login';
}

/**
 * Interactive MiniShop Sandbox view for Lab 01 (SQL Injection: Login & Product Search).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered MiniShop authentication and product search card.
 */
export function LabView({
  mode,
  payload,
  onPayloadChange,
  inputFlashSeq,
  isExecuting,
  lastResponse,
  onExecute,
}: LabViewProps): JSX.Element {
  const activeTab = resolveSubTab(payload);
  const username = readString(payload, 'username');
  const password = readString(payload, 'password');
  const keyword = readString(payload, 'keyword');
  const flashClass = inputFlashSeq > 0 ? 'vvwa-input-flash' : '';

  // @snippet:start
  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const requestBody = { username, password };
    // @step:fe-login-submit
    void onExecute('login', requestBody, {
      frontendStepsBefore: [
        {
          layer: 'frontend',
          tag: 'fe-login-submit',
          status: 'info',
          title: 'Gửi yêu cầu đăng nhập MiniShop',
          detail: `POST /api/labs/01-sql-injection/${mode}/login với username=${JSON.stringify(username)}`,
        },
      ],
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const requestBody = { keyword };
    // @step:fe-search-submit
    void onExecute('search_products', requestBody, {
      frontendStepsBefore: [
        {
          layer: 'frontend',
          tag: 'fe-search-submit',
          status: 'info',
          title: 'Gửi từ khóa tìm kiếm sản phẩm MiniShop',
          detail: `POST /api/labs/01-sql-injection/${mode}/search_products với keyword=${JSON.stringify(keyword)}`,
        },
      ],
    });
  };
  // @snippet:end

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShoppingBag className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <span>MiniShop Storefront</span>
        </div>

        <div role="tablist" aria-label="Tính năng MiniShop Lab 01" className="flex gap-1">
          <button
            id="sqli-tab-login"
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            aria-controls="sqli-panel-login"
            onClick={() => onPayloadChange({ ...payload, tab: 'login' })}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
              activeTab === 'login'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Đăng nhập</span>
          </button>
          <button
            id="sqli-tab-search"
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            aria-controls="sqli-panel-search"
            onClick={() => onPayloadChange({ ...payload, tab: 'search' })}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tìm kiếm sản phẩm</span>
          </button>
        </div>
      </div>

      {activeTab === 'login' ? (
        <form
          id="sqli-panel-login"
          role="tabpanel"
          aria-labelledby="sqli-tab-login"
          onSubmit={handleLoginSubmit}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="sqli-username" className="text-xs font-medium text-slate-700">
              Tên đăng nhập (Username)
            </label>
            <input
              key={`u-${inputFlashSeq}`}
              id="sqli-username"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(event) =>
                onPayloadChange({ ...payload, tab: 'login', username: event.target.value })
              }
              placeholder="Ví dụ: alice hoặc ' OR 1=1--"
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none ${flashClass}`}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="sqli-password" className="text-xs font-medium text-slate-700">
              Mật khẩu (Password)
            </label>
            <input
              key={`p-${inputFlashSeq}`}
              id="sqli-password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(event) =>
                onPayloadChange({ ...payload, tab: 'login', password: event.target.value })
              }
              placeholder="Ví dụ: password123"
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none ${flashClass}`}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <button
            type="submit"
            disabled={isExecuting}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isExecuting ? 'Đang đăng nhập...' : 'Đăng nhập MiniShop'}</span>
          </button>
          <LoginResultCard response={lastResponse} />
        </form>
      ) : (
        <form
          id="sqli-panel-search"
          role="tabpanel"
          aria-labelledby="sqli-tab-search"
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="sqli-keyword" className="text-xs font-medium text-slate-700">
              Từ khóa tìm kiếm sản phẩm
            </label>
            <input
              key={`k-${inputFlashSeq}`}
              id="sqli-keyword"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={keyword}
              onChange={(event) =>
                onPayloadChange({ ...payload, tab: 'search', keyword: event.target.value })
              }
              placeholder="Ví dụ: Ban phim hoặc ' AND 1=0 UNION SELECT ..."
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none ${flashClass}`}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <button
            type="submit"
            disabled={isExecuting}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isExecuting ? 'Đang tìm kiếm...' : 'Tìm kiếm sản phẩm'}</span>
          </button>
          <SearchResultList response={lastResponse} />
        </form>
      )}
    </div>
  );
}
