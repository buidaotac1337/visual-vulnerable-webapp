import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/06-path-traversal/frontend/LabView';
import {
  buildRenderSteps,
  readInvoices,
} from '../../../../labs/06-path-traversal/frontend/invoiceData';

const LAB_06_META: LabMetadata = {
  id: '06-path-traversal',
  title: 'Path Traversal — Tải hóa đơn MiniShop',
  category: 'File Handling',
  difficulty: 'Cơ bản',
  summary: 'Path traversal demo.',
  safetyPattern: 'Allowlist names and contain resolved paths.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['alice', 'bob'],
};

const MY_INVOICES = { invoices: [{ order_id: 1, file: 'INV-0001.txt', total_amount: 89 }] };

function response(data: Record<string, unknown>, ok = true): LabExecutionResponse {
  return {
    ok,
    data,
    meta: { lab_id: '06-path-traversal', mode: 'vulnerable', outcome: 'normal' },
    trace: [],
  };
}

function found(file: string, content: string): LabExecutionResponse {
  return response({ found: true, file, content, error: null });
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_06_META,
    mode: 'vulnerable',
    actor: 'alice',
    payload: { file: '../config/secrets.env' },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => response(MY_INVOICES)),
    ...overrides,
  };
}

describe('Lab 06 Path Traversal LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('06-path-traversal')).toBe(true);
    expect(await loadFrontendSinkModule('06-path-traversal')).toBeNull();
  });

  it('lists my invoices silently and requests the typed file name', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('list_invoices', {}, { silent: true });
    expect(await screen.findByText('INV-0001.txt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tải' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([a]) => a === 'download_invoice');
    expect(call?.[1]).toEqual({ file: '../config/secrets.env' });
    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({
        tag: 'fe-request-file',
        title: 'Tải file "../config/secrets.env"',
      }),
    );
    expect(options.frontendStepsAfter?.(found('../config/secrets.env', 'TOKEN=1'))).toEqual([
      expect.objectContaining({ tag: 'fe-render-file', status: 'danger' }),
    ]);
    expect(options.frontendStepsAfter?.(found('INV-0001.txt', 'Hóa đơn'))).toEqual([
      expect.objectContaining({ status: 'info', title: 'Hiển thị hóa đơn' }),
    ]);
    // Same rule as the backend: reaching my own invoice through a path is still flagged.
    expect(options.frontendStepsAfter?.(found('./INV-0001.txt', 'Hóa đơn'))).toEqual([
      expect.objectContaining({ status: 'danger' }),
    ]);
  });

  it("never shows one persona's invoices to another when a reload fails", async () => {
    const onExecute = vi.fn(async () => response(MY_INVOICES));
    const props = makeProps({ onExecute });
    const { rerender } = render(<LabView {...props} />);
    await screen.findByText('INV-0001.txt');

    onExecute.mockImplementation(async () => response({ error: 'SyntaxError' }, false));
    await act(async () => {
      rerender(<LabView {...props} actor="bob" />);
    });
    expect(screen.queryByText('INV-0001.txt')).toBeNull();
    expect(screen.getByText('Chưa có hóa đơn nào.')).toBeTruthy();
  });

  it('opens an invoice from the list', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: /INV-0001\.txt/ }));
    expect(props.onPayloadChange).toHaveBeenCalledWith({ file: 'INV-0001.txt' });
    expect(props.onExecute).toHaveBeenCalledWith(
      'download_invoice',
      { file: 'INV-0001.txt' },
      expect.anything(),
    );
  });

  it('warns when the server returns a file that is not my invoice', async () => {
    const leak = found('../config/secrets.env', 'MINISHOP_ADMIN_TOKEN=lab06-demo-token');
    render(<LabView {...makeProps({ lastResponse: leak })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File này không nằm trong danh sách hóa đơn của bạn',
    );
    expect(screen.getByText('MINISHOP_ADMIN_TOKEN=lab06-demo-token')).toBeTruthy();
  });

  it('shows my invoice without a warning and a denied file as not found', async () => {
    const props = makeProps({ lastResponse: found('INV-0001.txt', 'Đơn hàng #1 của alice') });
    const { rerender } = render(<LabView {...props} />);
    expect(await screen.findByText('Đơn hàng #1 của alice')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    // A handler that says found:false but leaves content behind must not show it.
    const leaky = response({
      found: false,
      file: 'export.csv',
      content: 'admin,admin@minishop.local',
      error: 'Không có hóa đơn export.csv.',
    });
    await act(async () => {
      rerender(<LabView {...props} lastResponse={leaky} />);
    });
    expect(screen.getByText('Không có hóa đơn export.csv.')).toBeTruthy();
    expect(screen.queryByText('admin,admin@minishop.local')).toBeNull();
    expect(buildRenderSteps(leaky, readInvoices(MY_INVOICES))).toEqual([
      expect.objectContaining({ status: 'info', title: 'Hiển thị "Không có hóa đơn"' }),
    ]);
  });

  it('disables download for an empty name and keeps the list on a failed reload', async () => {
    const onExecute = vi.fn(async () => response(MY_INVOICES));
    const props = makeProps({ onExecute, payload: { file: '' } });
    const { rerender } = render(<LabView {...props} />);
    await screen.findByText('INV-0001.txt');
    expect(screen.getByRole('button', { name: 'Tải' })).toBeDisabled();

    onExecute.mockImplementation(async () => response({ error: 'boom' }, false));
    await act(async () => {
      rerender(<LabView {...props} dbResetSeq={1} />);
    });
    expect(screen.getByText('INV-0001.txt')).toBeTruthy();
    expect(buildRenderSteps(response({ error: 'NameError' }, false), [])).toEqual([]);
  });
});
