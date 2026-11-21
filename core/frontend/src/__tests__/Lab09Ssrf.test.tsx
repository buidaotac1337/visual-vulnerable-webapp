import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasLabView, loadFrontendSinkModule } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabViewProps,
} from '@/types';

import { LabView } from '../../../../labs/09-ssrf/frontend/LabView';
import { buildRenderSteps } from '../../../../labs/09-ssrf/frontend/ssrfData';

const LAB_09_META: LabMetadata = {
  id: '09-ssrf',
  title: 'SSRF — Kiểm tra ảnh sản phẩm từ URL ngoài',
  category: 'SSRF',
  difficulty: 'Trung bình',
  summary: 'SSRF demo.',
  safetyPattern: 'Validate scheme, hostname allowlist, DNS/IP ranges, and disable redirects.',
  samplePayloads: [],
  verifyTests: [],
  actors: ['admin', 'alice'],
};

const CATALOG = {
  products: [
    { id: 1, name: 'Ban phim co MiniShop K1', price: 89, image_url: '/images/kb.png' },
    { id: 2, name: 'Chuot khong day Silent M2', price: 45, image_url: '/images/mouse.png' },
  ],
};

function makeResponse(
  data: Record<string, unknown>,
  outcome: 'normal' | 'exploited' | 'blocked' | 'error' = 'normal',
  ok = true,
): LabExecutionResponse {
  return {
    ok,
    data,
    meta: { lab_id: '09-ssrf', mode: 'vulnerable', outcome },
    trace: [],
  };
}

function makeProps(overrides: Partial<LabViewProps> = {}): LabViewProps {
  return {
    lab: LAB_09_META,
    mode: 'vulnerable',
    actor: 'admin',
    payload: { product_id: 1, image_url: 'http://minishop-cdn:8090/cdn/kb.png' },
    onPayloadChange: vi.fn(),
    inputFlashSeq: 0,
    dbResetSeq: 0,
    isExecuting: false,
    lastResponse: null,
    onExecute: vi.fn(async () => makeResponse(CATALOG)),
    ...overrides,
  };
}

describe('Lab 09 SSRF LabView', () => {
  it('is discovered dynamically without a frontend sink pair', async () => {
    expect(hasLabView('09-ssrf')).toBe(true);
    expect(await loadFrontendSinkModule('09-ssrf')).toBeNull();
  });

  it('loads products silently and submits fetch_product_image with fe-fetch-url and fe-render-preview steps', async () => {
    const props = makeProps();
    render(<LabView {...props} />);
    expect(props.onExecute).toHaveBeenCalledWith('list_products', {}, { silent: true });
    expect(await screen.findByText(/Ban phim co MiniShop K1/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra & Cập nhật ảnh' }));
    const call = vi.mocked(props.onExecute).mock.calls.find(([a]) => a === 'fetch_product_image');
    expect(call?.[1]).toEqual({
      product_id: 1,
      image_url: 'http://minishop-cdn:8090/cdn/kb.png',
    });

    const options = call?.[2] as ExecuteActionOptions;
    expect(options.frontendStepsBefore?.[0]).toEqual(
      expect.objectContaining({ tag: 'fe-fetch-url', status: 'info' }),
    );

    const safeUpdated = makeResponse({
      fetched: true,
      updated: true,
      blocked: false,
      leaked_internal: false,
      detected_type: 'png',
      size_bytes: 69,
    });
    expect(options.frontendStepsAfter?.(safeUpdated)).toEqual([
      expect.objectContaining({ tag: 'fe-render-preview', status: 'info' }),
    ]);

    const exploited = makeResponse(
      {
        fetched: true,
        updated: false,
        blocked: false,
        leaked_internal: true,
        requested_url: 'http://internal-metadata:8090/latest/meta-data/iam-credentials',
        final_url: 'http://internal-metadata:8090/latest/meta-data/iam-credentials',
      },
      'exploited',
    );
    expect(options.frontendStepsAfter?.(exploited)).toEqual([
      expect.objectContaining({ tag: 'fe-render-preview', status: 'danger' }),
    ]);

    const blocked = makeResponse(
      {
        fetched: false,
        updated: false,
        blocked: true,
        leaked_internal: false,
        error: "Host 'internal-metadata' không nằm trong allowlist.",
      },
      'blocked',
    );
    expect(options.frontendStepsAfter?.(blocked)).toEqual([
      expect.objectContaining({ tag: 'fe-render-preview', status: 'safe' }),
    ]);
  });

  it('renders danger SSRF leak preview, safe updated preview, and blocked state cleanly', async () => {
    const leakResp = makeResponse(
      {
        fetched: true,
        updated: false,
        blocked: false,
        leaked_internal: true,
        product_id: 1,
        requested_url: 'http://internal-metadata:8090/latest/meta-data/iam-credentials',
        final_url: 'http://internal-metadata:8090/latest/meta-data/iam-credentials',
        status_code: 200,
        content_type: 'application/json',
        size_bytes: 128,
        detected_type: null,
        body_preview: '{"access_key_id":"ASIA-VVWA-DEMO-9001"}',
        error: null,
      },
      'exploited',
    );
    const props = makeProps({ lastResponse: leakResp });
    const { rerender } = render(<LabView {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phát hiện SSRF — Rò rỉ phản hồi nội bộ!',
    );
    expect(screen.getByText('{"access_key_id":"ASIA-VVWA-DEMO-9001"}')).toBeTruthy();

    const safeResp = makeResponse({
      fetched: true,
      updated: true,
      blocked: false,
      leaked_internal: false,
      product_id: 1,
      requested_url: 'http://minishop-cdn:8090/cdn/kb.png',
      final_url: 'http://minishop-cdn:8090/cdn/kb.png',
      status_code: 200,
      content_type: 'image/png',
      size_bytes: 69,
      detected_type: 'png',
      body_preview: null,
      error: null,
    });
    await act(async () => {
      rerender(<LabView {...props} lastResponse={safeResp} />);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ảnh sản phẩm đã được kiểm tra và cập nhật',
    );

    const blockedResp = makeResponse(
      {
        fetched: false,
        updated: false,
        blocked: true,
        leaked_internal: false,
        product_id: 1,
        requested_url: 'http://internal-metadata:8090/admin/config',
        final_url: null,
        status_code: null,
        content_type: null,
        size_bytes: 0,
        detected_type: null,
        body_preview: null,
        error: "Host 'internal-metadata' không nằm trong allowlist được phép.",
      },
      'blocked',
    );
    await act(async () => {
      rerender(<LabView {...props} mode="secure" lastResponse={blockedResp} />);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Đã chặn yêu cầu URL không hợp lệ');
    expect(
      screen.getByText("Host 'internal-metadata' không nằm trong allowlist được phép."),
    ).toBeTruthy();
  });

  it('updates product_id and image_url controls and handles malformed/non-image responses', async () => {
    const onPayloadChange = vi.fn();
    render(<LabView {...makeProps({ onPayloadChange })} />);
    await screen.findByText(/Ban phim co MiniShop K1/);

    fireEvent.change(screen.getByLabelText('Sản phẩm cần cập nhật ảnh'), {
      target: { value: '2' },
    });
    expect(onPayloadChange).toHaveBeenLastCalledWith(expect.objectContaining({ product_id: 2 }));

    fireEvent.change(screen.getByLabelText('URL ảnh sản phẩm (image_url)'), {
      target: { value: 'http://minishop-cdn:8090/cdn/redirect-to-metadata' },
    });
    expect(onPayloadChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ image_url: 'http://minishop-cdn:8090/cdn/redirect-to-metadata' }),
    );

    expect(buildRenderSteps(makeResponse({ error: 'boom' }, 'error', false))).toEqual([]);
    await waitFor(() => {
      expect(
        buildRenderSteps(
          makeResponse({ fetched: false, updated: false, blocked: false, error: 'bad url' }),
        ),
      ).toEqual([expect.objectContaining({ tag: 'fe-render-preview', status: 'warning' })]);
    });
  });
});
