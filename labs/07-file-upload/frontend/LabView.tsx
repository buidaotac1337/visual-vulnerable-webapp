import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, JSX } from 'react';
import { ImagePlus, Upload } from 'lucide-react';

import { LabCard, PrimaryButton, TextField } from '@/components';
import type { LabExecutionResponse, LabPayload, LabViewProps } from '@/types';

import { UploadResult } from './UploadResult';
import {
  buildRenderSteps,
  decodeBase64Preview,
  readFileAsBase64,
  readUploadCatalog,
  readUploadResult,
} from './uploadData';
import type { ProductSummary, UploadCatalog } from './uploadData';

const LAB_ID = '07-file-upload';
const SELECT_CLASS =
  'rounded-large border border-input bg-input px-3 py-2 text-sm text-default focus:border-focused focus:outline-none disabled:cursor-not-allowed disabled:bg-disabled';
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

/** Load product list and webroot files silently on mount, mode/actor/reset, or saved upload. */
function useUploadCatalog(props: LabViewProps): UploadCatalog {
  const { actor, mode, dbResetSeq, lastResponse, onExecute } = props;
  const [catalog, setCatalog] = useState<UploadCatalog>({ products: [], files: [] });
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;
  const savedRef = useRef<LabExecutionResponse | null>(null);
  if (readUploadResult(lastResponse?.data)?.saved === true) {
    savedRef.current = lastResponse;
  }
  const savedUpload = savedRef.current;

  useEffect(() => {
    let active = true;
    void executeRef.current('list_products', {}, { silent: true }).then((response) => {
      if (active && response?.ok) {
        setCatalog(readUploadCatalog(response.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq, savedUpload]);

  return catalog;
}

/**
 * Interactive MiniShop product image uploader for Lab 07 (Unrestricted File Upload).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered product selector, file picker / tamper fields, and webroot listing.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const catalog = useUploadCatalog(props);
  const products = catalog.products.length > 0 ? catalog.products : DEFAULT_PRODUCTS;
  const productId = readNumber(payload, 'product_id', products[0]?.id ?? 1);
  const filename = readString(payload, 'filename');
  const contentType = readString(payload, 'content_type');
  const contentB64 = readString(payload, 'content_b64');
  const selectedProduct = products.find((item) => item.id === productId);
  const result = readUploadResult(lastResponse?.data);
  const [fileError, setFileError] = useState<string | null>(null);

  const update = (patch: LabPayload): void => onPayloadChange({ ...payload, ...patch });

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileError(null);
    void readFileAsBase64(file)
      .then((encoded) => {
        onPayloadChange({
          ...payload,
          product_id: productId,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          content_b64: encoded,
        });
      })
      .catch((err: unknown) => {
        setFileError(err instanceof Error ? err.message : 'Không đọc được file.');
      });
  };

  // @snippet:start
  const uploadFile = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const body = {
      product_id: productId,
      filename,
      content_type: contentType,
      content_b64: contentB64,
    };
    // @step:fe-upload-image
    void props.onExecute('upload_image', body, {
      frontendStepsBefore: [
        {
          layer: 'frontend',
          tag: 'fe-upload-image',
          status: 'info',
          title: `Tải file "${filename}" (${contentType})`,
          detail: `POST /api/labs/${LAB_ID}/${mode}/upload_image cho product_id=${String(productId)}`,
        },
      ],
      // @step:fe-render-upload
      frontendStepsAfter: (response) => buildRenderSteps(response),
    });
  };
  // @snippet:end

  return (
    <LabCard
      title="MiniShop · Ảnh sản phẩm"
      icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
      headerRight={<span className="text-xs text-subtlest">Đăng nhập: {actor ?? 'ẩn danh'}</span>}
    >
      <form onSubmit={uploadFile} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="fu-product" className="text-xs font-medium text-subtle">
            Sản phẩm cần cập nhật ảnh
          </label>
          <select
            id="fu-product"
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
            <p className="text-xs text-subtlest">
              Ảnh hiện tại: <code className="text-subtle">{selectedProduct.imageUrl}</code>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="fu-file" className="text-xs font-medium text-subtle">
            Chọn file từ máy (tùy chọn — tự điền Base64)
          </label>
          <input
            id="fu-file"
            type="file"
            disabled={isExecuting}
            onChange={handleFilePick}
            className="block w-full cursor-pointer rounded-large border border-dashed border-input bg-surface-sunken px-3 py-2 text-xs text-subtle file:mr-3 file:cursor-pointer file:rounded-medium file:border-0 file:bg-brand-subtlest file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand-subtlest-hovered disabled:cursor-not-allowed"
          />
          {fileError ? <p className="text-xs text-danger">{fileError}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="fu-filename"
            label="Tên file (filename)"
            value={filename}
            disabled={isExecuting}
            mono
            flashSeq={inputFlashSeq}
            onChange={(value) => update({ filename: value })}
          />
          <TextField
            id="fu-content-type"
            label="Content-Type (MIME header)"
            value={contentType}
            disabled={isExecuting}
            mono
            flashSeq={inputFlashSeq}
            onChange={(value) => update({ content_type: value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <TextField
            id="fu-content-b64"
            label="Nội dung (Base64)"
            value={contentB64}
            disabled={isExecuting}
            mono
            flashSeq={inputFlashSeq}
            onChange={(value) => update({ content_b64: value })}
          />
          <p className="truncate text-xs text-subtlest">
            Giải mã: <code className="text-subtle">{decodeBase64Preview(contentB64)}</code>
          </p>
        </div>

        <PrimaryButton
          type="submit"
          icon={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          isBusy={isExecuting}
          busyLabel="Đang tải lên..."
          className="self-end"
        >
          Tải ảnh lên
        </PrimaryButton>
      </form>

      <UploadResult result={result} files={catalog.files} />
    </LabCard>
  );
}
