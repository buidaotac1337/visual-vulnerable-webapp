import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Globe, Server } from 'lucide-react';

import { LabCard, PrimaryButton, TextField } from '@/components';
import type { LabExecutionResponse, LabPayload, LabViewProps } from '@/types';

import { PreviewCard } from './PreviewCard';
import { buildFetchStep, buildRenderSteps, readSsrfProducts, readSsrfResult } from './ssrfData';
import type { ProductSummary } from './ssrfData';

const LAB_ID = '09-ssrf';
const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50';
const DEFAULT_PRODUCTS: readonly ProductSummary[] = [1, 2, 3].map((id) => ({
  id,
  name: `Sản phẩm #${String(id)}`,
  price: 0,
  imageUrl: '',
}));

function readNumber(payload: LabPayload, key: string, fallback: number): number {
  const value = Number(payload[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readString(payload: LabPayload, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

/** Load product catalog silently on mount, actor/mode/reset, or updated product image. */
function useProductCatalog(props: LabViewProps): ProductSummary[] {
  const { actor, mode, dbResetSeq, lastResponse, onExecute } = props;
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;
  const updatedRef = useRef<LabExecutionResponse | null>(null);
  if (readSsrfResult(lastResponse?.data)?.updated === true) {
    updatedRef.current = lastResponse;
  }
  const latestUpdate = updatedRef.current;

  useEffect(() => {
    let active = true;
    void executeRef.current('list_products', {}, { silent: true }).then((response) => {
      if (active && response?.ok) {
        setProducts(readSsrfProducts(response.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq, latestUpdate]);

  return products;
}

/**
 * Interactive MiniShop product image URL fetcher for Lab 09 (Server-Side Request Forgery).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered product selector, image URL input form, internal service notes, and preview.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const loadedProducts = useProductCatalog(props);
  const products = loadedProducts.length > 0 ? loadedProducts : DEFAULT_PRODUCTS;
  const productId = readNumber(payload, 'product_id', products[0]?.id ?? 1);
  const imageUrl = readString(payload, 'image_url');
  const selectedProduct = products.find((item) => item.id === productId);
  const result = readSsrfResult(lastResponse?.data);

  const update = (patch: LabPayload): void => onPayloadChange({ ...payload, ...patch });

  // @snippet:start
  const fetchImage = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const body = { product_id: productId, image_url: imageUrl };
    // @step:fe-fetch-url
    void props.onExecute('fetch_product_image', body, {
      frontendStepsBefore: [buildFetchStep(LAB_ID, mode, productId, imageUrl)],
      // @step:fe-render-preview
      frontendStepsAfter: (response) => buildRenderSteps(response),
    });
  };
  // @snippet:end

  return (
    <LabCard
      title="MiniShop · Nhập ảnh sản phẩm từ URL"
      icon={<Globe className="h-4 w-4" aria-hidden="true" />}
      headerRight={<span className="text-xs text-slate-500">Đăng nhập: {actor ?? 'ẩn danh'}</span>}
    >
      <div className="flex items-start gap-2 rounded-lg border border-info-200 bg-info-50 px-3 py-2 text-xs text-info-900">
        <Server className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-600" aria-hidden="true" />
        <p className="leading-relaxed">
          Mạng nội bộ demo: CDN ảnh hợp lệ tại <code>http://minishop-cdn:8090/cdn/kb.png</code> (hỗ
          trợ <code>kb.png</code>, <code>mouse.png</code>, <code>headset.png</code>), còn dịch vụ
          nhạy cảm nội bộ chạy tại <code>http://internal-metadata:8090</code>.
        </p>
      </div>

      <form onSubmit={fetchImage} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="ssrf-product" className="text-xs font-medium text-slate-700">
            Sản phẩm cần cập nhật ảnh
          </label>
          <select
            id="ssrf-product"
            disabled={isExecuting}
            value={productId}
            onChange={(event) => update({ product_id: Number(event.target.value) })}
            className={SELECT_CLASS}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                #{product.id} — {product.name}
              </option>
            ))}
          </select>
          {selectedProduct?.imageUrl ? (
            <p className="truncate text-xs text-slate-500">
              Ảnh hiện tại: <code className="text-slate-700">{selectedProduct.imageUrl}</code>
            </p>
          ) : null}
        </div>

        <TextField
          id="ssrf-url"
          label="URL ảnh sản phẩm (image_url)"
          value={imageUrl}
          disabled={isExecuting}
          placeholder="http://minishop-cdn:8090/cdn/kb.png"
          mono
          flashSeq={inputFlashSeq}
          onChange={(value) => update({ image_url: value })}
        />

        <PrimaryButton
          type="submit"
          icon={<Globe className="h-3.5 w-3.5" aria-hidden="true" />}
          isBusy={isExecuting}
          busyLabel="Đang kiểm tra URL..."
          className="self-end"
        >
          Kiểm tra &amp; Cập nhật ảnh
        </PrimaryButton>
      </form>

      <PreviewCard result={result} />
    </LabCard>
  );
}
