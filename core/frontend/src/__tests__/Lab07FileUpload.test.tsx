import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/07-file-upload/frontend/LabView';
import {
  buildRenderSteps,
  decodeBase64Preview,
} from '../../../../labs/07-file-upload/frontend/uploadData';

const LAB_07_META: LabMetadata = {
  id: '07-file-upload',
  title: 'File Upload — Tải ảnh sản phẩm MiniShop',
  category: 'File Handling',
  difficulty: 'Trung bình',
  summary: 'File upload demo.',
  safetyPattern: 'Check magic bytes, generate UUID filename, contain inside uploads/.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['admin', 'alice'],
};

const VALID_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPwd3sKAAJiAXvBJn9xAAAAAElFTkSuQmCC';

const CATALOG = {
  products: [
    { id: 1, name: 'Ban phim co MiniShop K1', price: 89, image_url: '/images/kb.png' },
    { id: 2, name: 'Chuot khong day Silent M2', price: 45, image_url: '/images/mouse.png' },
  ],
  files: [
    {
      relative_path: 'index.html',
      url: '/index.html',
      in_uploads: false,
      size_bytes: 58,
      executable_risk: false,
    },
    {
      relative_path: 'uploads/shell.py',
      url: '/uploads/shell.py',
      in_uploads: true,
      size_bytes: 12,
      executable_risk: true,
    },
  ],
};

function response(data: Record<string, unknown>, ok = true): LabExecutionResponse {
  return {
    ok,
    data,
    meta: { lab_id: '07-file-upload', mode: 'vulnerable', outcome: 'normal' },
    trace: [],
  };
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_07_META,
    mode: 'vulnerable',
    actor: 'admin',
    payload: {
      product_id: 1,
      filename: 'shell.py',
      content_type: 'image/png',
      content_b64: 'cHJpbnQoJ1JDRScp',
    },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => response(CATALOG)),
    ...overrides,
  };
}

describe('Lab 07 File Upload LabView', () => {
  it('is discovered without a frontend sink pair', async () => {
    expect(hasLabView('07-file-upload')).toBe(true);
    expect(await loadFrontendSinkModule('07-file-upload')).toBeNull();
  });

  it('loads products silently and submits upload_image with fe-upload-image and fe-render-upload trace steps', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('list_products', {}, { silent: true });
    expect(await screen.findByText('uploads/shell.py')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([a]) => a === 'upload_image');
    expect(call?.[1]).toEqual({
      product_id: 1,
      filename: 'shell.py',
      content_type: 'image/png',
      content_b64: 'cHJpbnQoJ1JDRScp',
    });

    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({
        tag: 'fe-upload-image',
        title: 'Tải file "shell.py" (image/png)',
      }),
    );

    const exploited = response({
      saved: true,
      product_id: 1,
      original_name: 'shell.py',
      stored_name: 'shell.py',
      url: '/uploads/shell.py',
      detected_type: null,
      escaped_uploads: false,
      size_bytes: 12,
      error: null,
    });
    expect(options.frontendStepsAfter?.(exploited)).toEqual([
      expect.objectContaining({ tag: 'fe-render-upload', status: 'danger' }),
    ]);

    const safe = response({
      saved: true,
      product_id: 1,
      original_name: 'kb.png',
      stored_name: 'abc123.png',
      url: '/uploads/abc123.png',
      detected_type: 'png',
      escaped_uploads: false,
      size_bytes: 69,
      error: null,
    });
    expect(options.frontendStepsAfter?.(safe)).toEqual([
      expect.objectContaining({ tag: 'fe-render-upload', status: 'info' }),
    ]);

    const rejected = response({ saved: false, error: 'Chỉ chấp nhận ảnh PNG.' });
    expect(options.frontendStepsAfter?.(rejected)).toEqual([
      expect.objectContaining({ tag: 'fe-render-upload', status: 'info' }),
    ]);
  });

  it('encodes a selected local file via FileReader and fills payload fields', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ onPayloadChange })} />);
    await screen.findByText('uploads/shell.py');

    const input = screen.getByLabelText('Chọn file từ máy (tùy chọn — tự điền Base64)');
    const file = new File(['print("ok")'], 'demo.py', { type: 'text/x-python' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onPayloadChange).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 1,
          filename: 'demo.py',
          content_type: 'text/x-python',
          content_b64: 'cHJpbnQoIm9rIik=',
        }),
      );
    });
  });

  it('supports tampering filename/content_type/base64 and previews decoded text or binary bytes', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ onPayloadChange })} />);
    await screen.findByText('uploads/shell.py');

    expect(screen.getByText("print('RCE')")).toBeTruthy();
    expect(decodeBase64Preview(VALID_PNG_B64)).toContain('[Nhị phân · 69 B · header: 89 50 4e 47');
    expect(decodeBase64Preview('')).toBe('(Trống)');
    expect(decodeBase64Preview('%%%')).toBe('(Base64 không hợp lệ)');

    fireEvent.change(screen.getByLabelText('Tên file (filename)'), {
      target: { value: '../index.html' },
    });
    expect(onPayloadChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filename: '../index.html' }),
    );

    fireEvent.change(screen.getByLabelText('Content-Type (MIME header)'), {
      target: { value: 'image/svg+xml' },
    });
    expect(onPayloadChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ content_type: 'image/svg+xml' }),
    );
  });

  it('renders danger ResultNotice for exploited/escaped upload and safe/neutral notices without alert', async () => {
    const exploitResp = response({
      saved: true,
      product_id: 1,
      original_name: '../index.html',
      stored_name: '../index.html',
      url: '/index.html',
      detected_type: null,
      escaped_uploads: true,
      size_bytes: 24,
      error: null,
    });
    const props = makeProps({ lastResponse: exploitResp });
    const { rerender } = render(<LabView {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Đường dẫn đã thoát khỏi uploads/');

    const safeResp = response({
      saved: true,
      product_id: 1,
      original_name: 'kb.png',
      stored_name: 'deadbeef.png',
      url: '/uploads/deadbeef.png',
      detected_type: 'png',
      escaped_uploads: false,
      size_bytes: 69,
      error: null,
    });
    await act(async () => {
      rerender(<LabView {...props} lastResponse={safeResp} />);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Ảnh sản phẩm đã được lưu an toàn')).toBeTruthy();
    const listCallsAfterSafe = vi
      .mocked(props.onExecute)
      .mock.calls.filter(([a]) => a === 'list_products').length;

    const deniedResp = response({
      saved: false,
      error: 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ.',
    });
    await act(async () => {
      rerender(<LabView {...props} lastResponse={deniedResp} />);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ.')).toBeTruthy();
    const listCallsAfterDenied = vi
      .mocked(props.onExecute)
      .mock.calls.filter(([a]) => a === 'list_products').length;
    expect(listCallsAfterDenied).toBe(listCallsAfterSafe);
    expect(buildRenderSteps(response({ error: 'boom' }, false))).toEqual([]);
  });
});
