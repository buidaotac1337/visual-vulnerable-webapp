import { fireEvent, render, screen } from '@testing-library/react';
import { Eye, KeyRound, PackageSearch, Play, Search, ShoppingBag } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import {
  AddressBar,
  LabCard,
  PrimaryButton,
  ResultNotice,
  SubTabBar,
  TextField,
} from '@/components';
import type { SubTabItem } from '@/components';

describe('LabCard', () => {
  it('renders title, icon, headerRight slot, and body children', () => {
    render(
      <LabCard
        title="MiniShop · Kiểm thử"
        icon={<ShoppingBag className="h-4 w-4" />}
        headerRight={<span>actor: alice</span>}
        className="custom-card"
      >
        <p>Nội dung thẻ</p>
      </LabCard>,
    );

    expect(screen.getByText('MiniShop · Kiểm thử')).toBeInTheDocument();
    expect(screen.getByText('actor: alice')).toBeInTheDocument();
    expect(screen.getByText('Nội dung thẻ').parentElement).toHaveClass('custom-card');
  });
});

describe('PrimaryButton', () => {
  it('defaults to button type, supports click, and switches accessible label while busy', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <PrimaryButton
        icon={<Play className="h-3.5 w-3.5" />}
        onClick={onClick}
        busyLabel="Đang chạy..."
        className="self-start"
      >
        Thực thi
      </PrimaryButton>,
    );

    const idleBtn = screen.getByRole('button', { name: 'Thực thi' });
    expect(idleBtn).toHaveAttribute('type', 'button');
    expect(idleBtn).toBeEnabled();
    expect(idleBtn).toHaveClass('self-start');
    fireEvent.click(idleBtn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <PrimaryButton isBusy busyLabel="Đang chạy..." type="submit">
        Thực thi
      </PrimaryButton>,
    );

    const busyBtn = screen.getByRole('button', { name: 'Đang chạy...' });
    expect(busyBtn).toHaveAttribute('type', 'submit');
    expect(busyBtn).toBeDisabled();
  });

  it('respects disabled prop when idle', () => {
    render(<PrimaryButton disabled>Khóa</PrimaryButton>);
    expect(screen.getByRole('button', { name: 'Khóa' })).toBeDisabled();
  });
});

describe('TextField', () => {
  it('links label to input, preserves input instance while typing, and flashes on flashSeq bump', () => {
    const onChange = vi.fn();
    const base = { id: 'tf-user', label: 'Tên đăng nhập', onChange, mono: true };
    const { rerender } = render(<TextField {...base} value="a" flashSeq={0} />);

    const inputBefore = screen.getByLabelText('Tên đăng nhập') as HTMLInputElement;
    expect(inputBefore).toHaveAttribute('autocomplete', 'off');
    expect(inputBefore).toHaveAttribute('spellcheck', 'false');
    expect(inputBefore.style.fontFamily).toContain('var(--font-mono)');
    expect(inputBefore).not.toHaveClass('vvwa-input-flash');

    fireEvent.change(inputBefore, { target: { value: 'alice' } });
    expect(onChange).toHaveBeenCalledWith('alice');

    rerender(<TextField {...base} value="alice" flashSeq={0} />);
    expect(screen.getByLabelText('Tên đăng nhập')).toBe(inputBefore);

    rerender(<TextField {...base} value="' OR 1=1--" flashSeq={1} />);
    const flashed = screen.getByLabelText('Tên đăng nhập');
    expect(flashed).not.toBe(inputBefore);
    expect(flashed).toHaveClass('vvwa-input-flash');
  });
});

describe('AddressBar', () => {
  it('renders prefix and input, submits when valid, and blocks submit when disabled or busy', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const base = {
      id: 'ab-url',
      ariaLabel: 'Đường dẫn tải file',
      prefix: '/invoices/download?file=',
      onChange,
      onSubmit,
      submitLabel: 'Tải',
      busyLabel: 'Đang tải...',
    };
    const { rerender } = render(<AddressBar {...base} value="INV-0001.txt" flashSeq={1} />);

    expect(screen.getByText('/invoices/download?file=')).toBeInTheDocument();
    const input = screen.getByLabelText('Đường dẫn tải file');
    expect(input).toHaveClass('vvwa-input-flash');

    fireEvent.change(input, { target: { value: '../secret.env' } });
    expect(onChange).toHaveBeenCalledWith('../secret.env');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(<AddressBar {...base} value="" submitDisabled />);
    expect(screen.getByRole('button', { name: 'Tải' })).toBeDisabled();
    fireEvent.submit(
      screen.getByLabelText('Đường dẫn tải file').closest('form') as HTMLFormElement,
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(<AddressBar {...base} value="INV-0001.txt" isBusy />);
    expect(screen.getByRole('button', { name: 'Đang tải...' })).toBeDisabled();
  });
});

describe('ResultNotice', () => {
  it('assigns alert, status, and omitted ARIA roles per tone and supports title/icon overrides', () => {
    const { rerender } = render(
      <ResultNotice tone="danger" title="Cảnh báo bảo mật">
        Phát hiện truy cập trái phép.
      </ResultNotice>,
    );
    const alertBox = screen.getByRole('alert');
    expect(alertBox).toHaveTextContent('Cảnh báo bảo mật');
    expect(alertBox).toHaveTextContent('Phát hiện truy cập trái phép.');

    rerender(<ResultNotice tone="warning">Cú pháp SQL không hợp lệ.</ResultNotice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Cú pháp SQL không hợp lệ.');

    rerender(<ResultNotice tone="safe">Đã lưu hồ sơ.</ResultNotice>);
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu hồ sơ.');

    rerender(<ResultNotice tone="info">Đang xử lý ở chế độ đọc.</ResultNotice>);
    expect(screen.getByRole('status')).toHaveTextContent('Đang xử lý ở chế độ đọc.');

    rerender(
      <ResultNotice tone="neutral" icon={<PackageSearch className="h-4 w-4" />}>
        Không tìm thấy kết quả.
      </ResultNotice>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Không tìm thấy kết quả.')).toBeInTheDocument();

    rerender(
      <ResultNotice tone="danger" role={null}>
        Cảnh báo tĩnh.
      </ResultNotice>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SubTabBar', () => {
  const ITEMS: readonly SubTabItem<'login' | 'search' | 'view'>[] = [
    {
      id: 'login',
      label: 'Đăng nhập',
      icon: <KeyRound className="h-3.5 w-3.5" />,
      buttonId: 'tab-login',
      controlsId: 'panel-login',
    },
    { id: 'search', label: 'Tìm kiếm', icon: <Search className="h-3.5 w-3.5" /> },
    { id: 'view', label: 'Xem', icon: <Eye className="h-3.5 w-3.5" /> },
  ];

  it('exposes tablist/tab ARIA attributes and supports click and keyboard navigation', () => {
    const onChange = vi.fn();
    render(
      <SubTabBar
        ariaLabel="Tính năng MiniShop"
        items={ITEMS}
        activeId="login"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Tính năng MiniShop' })).toBeInTheDocument();
    const loginTab = screen.getByRole('tab', { name: 'Đăng nhập' });
    const searchTab = screen.getByRole('tab', { name: 'Tìm kiếm' });
    const viewTab = screen.getByRole('tab', { name: 'Xem' });

    expect(loginTab).toHaveAttribute('id', 'tab-login');
    expect(loginTab).toHaveAttribute('aria-controls', 'panel-login');
    expect(loginTab).toHaveAttribute('aria-selected', 'true');
    expect(loginTab).toHaveAttribute('tabindex', '0');
    expect(searchTab).toHaveAttribute('aria-selected', 'false');
    expect(searchTab).toHaveAttribute('tabindex', '-1');

    fireEvent.click(searchTab);
    expect(onChange).toHaveBeenCalledWith('search');

    loginTab.focus();
    fireEvent.keyDown(loginTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('search');
    expect(searchTab).toHaveFocus();

    fireEvent.keyDown(loginTab, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('view');
    expect(viewTab).toHaveFocus();

    fireEvent.keyDown(viewTab, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('login');
    expect(loginTab).toHaveFocus();

    fireEvent.keyDown(loginTab, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('view');
    expect(viewTab).toHaveFocus();
  });
});
