import type { JSX } from 'react';
import { AlertTriangle, FileImage, FolderOpen, ShieldBan } from 'lucide-react';

import { ResultNotice } from '@/components';

import { isDangerousUpload } from './uploadData';
import type { UploadResultData, WebrootFile } from './uploadData';

export interface UploadResultProps {
  /** Parsed outcome of the latest upload_image request, or null before the first upload. */
  result: UploadResultData | null;
  /** Files currently present in <sandbox>/webroot/. */
  files: readonly WebrootFile[];
}

function dangerMessage(result: UploadResultData): string {
  if (result.escapedUploads) {
    return `Đường dẫn đã thoát khỏi uploads/ tới ${result.url ?? 'ngoài webroot'}.`;
  }
  const target = result.url ?? result.storedName ?? result.originalName;
  return `Nội dung không phải ảnh hợp lệ (type=${result.detectedType ?? 'none'}), lưu tại ${target}.`;
}

function renderStatusNotice(result: UploadResultData | null): JSX.Element {
  if (!result) {
    return (
      <p className="text-xs text-subtlest">
        Chọn file hoặc dùng payload mẫu, sau đó bấm <strong>Tải ảnh lên</strong>.
      </p>
    );
  }
  if (!result.saved) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<ShieldBan className="h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />}
      >
        {result.error ?? 'Upload bị từ chối.'}
      </ResultNotice>
    );
  }
  if (isDangerousUpload(result)) {
    return (
      <ResultNotice tone="danger" title="File nguy hiểm đã được ghi lên server!">
        <p>{dangerMessage(result)}</p>
      </ResultNotice>
    );
  }
  return (
    <ResultNotice tone="safe" title="Ảnh sản phẩm đã được lưu an toàn">
      <p>
        Tên lưu: <code className="font-semibold">{result.storedName}</code> · URL:{' '}
        <code>{result.url}</code> ({result.detectedType?.toUpperCase()}, {result.sizeBytes} B)
      </p>
    </ResultNotice>
  );
}

/**
 * Render the upload outcome notice and live <sandbox>/webroot/ file inventory.
 *
 * @param props - Latest upload result and current sandbox webroot files.
 * @returns Rendered status banner and webroot file list.
 */
export function UploadResult({ result, files }: UploadResultProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {renderStatusNotice(result)}

      <section aria-label="Tệp trong webroot sandbox" className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-subtle">
          <FolderOpen className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          <span>Tệp hiện có trong webroot/</span>
        </h3>

        {files.length === 0 ? (
          <p className="text-xs text-subtlest">Chưa có tệp nào trong webroot.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li
                key={file.relativePath}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-large border px-2.5 py-1.5 text-xs ${
                  file.executableRisk
                    ? 'border-danger-subtle bg-danger text-danger-bolder'
                    : 'border-default bg-surface-sunken text-subtle'
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {file.executableRisk ? (
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0 text-danger"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileImage className="h-3.5 w-3.5 shrink-0 text-subtlest" aria-hidden="true" />
                  )}
                  <code className="truncate font-semibold">{file.relativePath}</code>
                </span>
                <span className="flex items-center gap-2">
                  <span>{file.sizeBytes} B</span>
                  {file.executableRisk ? (
                    <span className="rounded-full bg-danger-subtler px-2 py-0.5 text-xs font-semibold text-danger-bolder">
                      {file.inUploads ? 'Nguy cơ thực thi' : 'Ngoài uploads/'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success">
                      {file.inUploads ? 'An toàn' : 'Webroot gốc'}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
