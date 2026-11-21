import type { FormEvent, JSX } from 'react';
import { KeyRound, LogIn, Search, ShoppingBag } from 'lucide-react';

import { LabCard, PrimaryButton, SubTabBar, TextField } from '@/components';
import type { SubTabItem } from '@/components';
import type { LabPayload, LabViewProps } from '@/types';

import { LoginResultCard, SearchResultList } from './ResultCards';

type SubTab = 'login' | 'search';

const SUB_TABS: readonly SubTabItem<SubTab>[] = [
  {
    id: 'login',
    label: 'Đăng nhập',
    icon: <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />,
    buttonId: 'sqli-tab-login',
    controlsId: 'sqli-panel-login',
  },
  {
    id: 'search',
    label: 'Tìm kiếm sản phẩm',
    icon: <Search className="h-3.5 w-3.5" aria-hidden="true" />,
    buttonId: 'sqli-tab-search',
    controlsId: 'sqli-panel-search',
  },
];

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
    <LabCard
      title="MiniShop Storefront"
      icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
      headerRight={
        <SubTabBar
          ariaLabel="Tính năng MiniShop Lab 01"
          items={SUB_TABS}
          activeId={activeTab}
          onChange={(tab) => onPayloadChange({ ...payload, tab })}
        />
      }
    >
      {activeTab === 'login' ? (
        <form
          id="sqli-panel-login"
          role="tabpanel"
          aria-labelledby="sqli-tab-login"
          onSubmit={handleLoginSubmit}
          className="flex flex-col gap-3"
        >
          <TextField
            id="sqli-username"
            label="Tên đăng nhập (Username)"
            value={username}
            onChange={(value) => onPayloadChange({ ...payload, tab: 'login', username: value })}
            placeholder="Ví dụ: alice hoặc ' OR 1=1--"
            mono
            flashSeq={inputFlashSeq}
          />

          <TextField
            id="sqli-password"
            label="Mật khẩu (Password)"
            value={password}
            onChange={(value) => onPayloadChange({ ...payload, tab: 'login', password: value })}
            placeholder="Ví dụ: password123"
            mono
            flashSeq={inputFlashSeq}
          />

          <PrimaryButton
            type="submit"
            icon={<LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
            isBusy={isExecuting}
            busyLabel="Đang đăng nhập..."
            className="self-start"
          >
            Đăng nhập MiniShop
          </PrimaryButton>
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
          <TextField
            id="sqli-keyword"
            label="Từ khóa tìm kiếm sản phẩm"
            value={keyword}
            onChange={(value) => onPayloadChange({ ...payload, tab: 'search', keyword: value })}
            placeholder="Ví dụ: Ban phim hoặc ' AND 1=0 UNION SELECT ..."
            mono
            flashSeq={inputFlashSeq}
          />

          <PrimaryButton
            type="submit"
            icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />}
            isBusy={isExecuting}
            busyLabel="Đang tìm kiếm..."
            className="self-start"
          >
            Tìm kiếm sản phẩm
          </PrimaryButton>
          <SearchResultList response={lastResponse} />
        </form>
      )}
    </LabCard>
  );
}
