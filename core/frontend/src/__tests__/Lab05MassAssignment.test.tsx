import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/05-mass-assignment/frontend/LabView';
import {
  buildRenderSteps,
  escalations,
  readProfile,
} from '../../../../labs/05-mass-assignment/frontend/profileData';

const LAB_05_META: LabMetadata = {
  id: '05-mass-assignment',
  title: 'Mass Assignment — Cập nhật hồ sơ khách hàng MiniShop',
  category: 'Access Control',
  difficulty: 'Cơ bản',
  summary: 'Mass assignment demo.',
  safetyPattern: 'Allowlist fields with a schema.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['alice', 'bob'],
};

const BOB = { id: 3, username: 'bob', email: 'bob@minishop.local', role: 'customer', balance: 250 };

function response(data: Record<string, unknown>, ok = true): LabExecutionResponse {
  return {
    ok,
    data,
    meta: { lab_id: '05-mass-assignment', mode: 'vulnerable', outcome: 'normal' },
    trace: [],
  };
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_05_META,
    mode: 'vulnerable',
    actor: 'bob',
    payload: { email: 'bob@minishop.local', role: 'admin' },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => response({ profile: BOB })),
    ...overrides,
  };
}

describe('Lab 05 Mass Assignment LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('05-mass-assignment')).toBe(true);
    expect(await loadFrontendSinkModule('05-mass-assignment')).toBeNull();
  });

  it('loads the profile silently and sends the whole request body', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('load_profile', {}, { silent: true });
    expect(await screen.findByText('$250.00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu (kèm trường ẩn)' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([a]) => a === 'update_profile');
    expect(call?.[1]).toEqual({ email: 'bob@minishop.local', role: 'admin' });
    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({
        tag: 'fe-submit-profile',
        status: 'warning',
        title: 'Gửi form hồ sơ kèm trường ngoài form: role',
      }),
    );
    const escalated = response({ updated: true, profile: { ...BOB, role: 'admin' }, error: null });
    expect(options.frontendStepsAfter?.(escalated)).toEqual([
      expect.objectContaining({ status: 'danger', detail: 'role: customer → admin' }),
    ]);
  });

  it('warns when the server stored a field the form does not have', async () => {
    const props = makeProps();
    const { rerender } = render(<LabView {...props} />);
    await screen.findByText('$250.00');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu (kèm trường ẩn)' }));

    const escalated = response({
      updated: true,
      profile: { ...BOB, role: 'admin', balance: 1000 },
      error: null,
    });
    await act(async () => {
      rerender(<LabView {...props} lastResponse={escalated} />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Server đã ghi cả trường ngoài form: role: customer → admin; balance: $250.00 → $1000.00.',
    );
    expect(props.onExecute).toHaveBeenCalledTimes(3);
  });

  it('shows a rejection without reloading the profile', async () => {
    const props = makeProps();
    const { rerender } = render(<LabView {...props} />);
    await screen.findByText('$250.00');
    const error = 'Không được phép cập nhật trường: role.';
    await act(async () => {
      rerender(
        <LabView {...props} lastResponse={response({ updated: false, profile: BOB, error })} />,
      );
    });
    expect(screen.getByText(error)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(props.onExecute).toHaveBeenCalledTimes(1);
  });

  it('edits, removes, and adds request fields outside the form', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ onPayloadChange })} />);
    await screen.findByText('$250.00');

    fireEvent.change(screen.getByLabelText('Giá trị trường role'), { target: { value: 'staff' } });
    expect(onPayloadChange).toHaveBeenLastCalledWith({
      email: 'bob@minishop.local',
      role: 'staff',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ trường role' }));
    expect(onPayloadChange).toHaveBeenLastCalledWith({ email: 'bob@minishop.local' });

    const add = screen.getByRole('button', { name: 'Thêm trường' });
    fireEvent.change(screen.getByLabelText('Tên trường mới'), { target: { value: 'email' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tên trường mới'), { target: { value: ' balance ' } });
    fireEvent.change(screen.getByLabelText('Giá trị trường mới'), { target: { value: '999' } });
    fireEvent.click(add);
    expect(onPayloadChange).toHaveBeenLastCalledWith({
      email: 'bob@minishop.local',
      role: 'admin',
      balance: '999',
    });
  });

  it('keeps the profile when a silent reload fails and ignores error envelopes', async () => {
    const onExecute = vi.fn(async () => response({ profile: BOB }));
    const props = makeProps({ onExecute, payload: { email: 'bob@minishop.local' } });
    const { rerender } = render(<LabView {...props} />);
    await screen.findByText('$250.00');
    expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeTruthy();

    onExecute.mockImplementation(async () => response({ error: 'boom' }, false));
    await act(async () => {
      rerender(<LabView {...props} dbResetSeq={1} />);
    });
    expect(screen.getByText('$250.00')).toBeTruthy();

    const crashed = response({ error: 'NameError' }, false);
    expect(buildRenderSteps(crashed, readProfile(BOB))).toEqual([]);
    expect(escalations(null, readProfile(BOB))).toEqual([]);
  });
});
