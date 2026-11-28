import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { BookOpen, Search, X } from 'lucide-react';

import { filterGlossary } from '@/lib';
import type { GlossaryCategory, GlossaryEntry } from '@/lib';

/** Props for the beginner security & workspace glossary dialog. */
export interface GlossaryModalProps {
  /** Whether the modal dialog is currently visible. */
  isOpen: boolean;
  /** Optional term ID to highlight and bring into view when opening. */
  initialTermId?: string | null;
  /** Callback invoked when the user closes the modal (button, backdrop, or Esc). */
  onClose: () => void;
}

type FilterOption = GlossaryCategory | 'all';

const CATEGORY_TABS: ReadonlyArray<{ id: FilterOption; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'workspace', label: 'Giao diện VVWA' },
  { id: 'vulnerability', label: 'Lỗ hổng' },
  { id: 'defense', label: 'Cách phòng vệ' },
];

const CATEGORY_BADGE: Record<GlossaryCategory, { label: string; className: string }> = {
  workspace: { label: 'Giao diện VVWA', className: 'bg-accent-blue-subtlest text-accent-blue' },
  vulnerability: { label: 'Lỗ hổng', className: 'bg-danger text-danger' },
  defense: { label: 'Cách phòng vệ', className: 'bg-success text-success' },
};

function GlossaryItemCard({
  entry,
  highlighted,
}: {
  entry: GlossaryEntry;
  highlighted: boolean;
}): JSX.Element {
  const badge = CATEGORY_BADGE[entry.category];
  return (
    <li
      data-term-id={entry.id}
      data-highlighted={highlighted ? 'true' : undefined}
      className={`rounded-xlarge border p-3 transition ${
        highlighted
          ? 'border-brand bg-brand-subtlest ring-2 ring-focused'
          : 'border-default bg-surface-raised'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-default">{entry.term}</h3>
          {highlighted ? (
            <span className="rounded-full bg-brand-bold px-2 py-0.5 text-micro font-semibold text-inverse">
              Đang xem
            </span>
          ) : null}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-default">{entry.shortMeaning}</p>
      <p className="mt-1.5 rounded-large bg-surface-sunken px-2.5 py-1.5 text-xs leading-relaxed text-subtle">
        <span className="font-semibold text-default">Ví dụ đời thường: </span>
        {entry.analogy}
      </p>
      {entry.tip ? (
        <p className="mt-1.5 text-xs text-brand">
          <span className="font-semibold">Mẹo: </span>
          {entry.tip}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Native <dialog> modal presenting VVWA's beginner security & workspace glossary
 * with Vietnamese search, category filters, and highlighted deep-linked terms.
 *
 * @param props - Open state, optional initial highlighted term, and close callback.
 * @returns Rendered GlossaryModal dialog element, or null when closed.
 */
export function GlossaryModal({
  isOpen,
  initialTermId = null,
  onClose,
}: GlossaryModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FilterOption>('all');
  const [prevKey, setPrevKey] = useState(`${isOpen}:${initialTermId ?? ''}`);

  const currentKey = `${isOpen}:${initialTermId ?? ''}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (isOpen && initialTermId) {
      setQuery('');
      setCategory('all');
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const entries = filterGlossary(query, category);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vvwa-glossary-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-auto w-full max-w-2xl rounded-xxlarge border border-default bg-surface-raised p-0 text-default shadow-overlay backdrop:bg-blanket"
    >
      <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand" aria-hidden="true" />
          <div>
            <h2 id="vvwa-glossary-title" className="text-base font-semibold text-default">
              Từ điển Bảo mật &amp; Giao diện VVWA
            </h2>
            <p className="text-xs text-subtle">
              Giải thích ngắn gọn bằng ví dụ đời thường cho người mới bắt đầu.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng từ điển"
          className="rounded-large p-1.5 text-subtlest transition hover:bg-neutral-subtle-hovered hover:text-default"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 border-b border-default bg-surface-sunken px-5 py-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtlest"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm thuật ngữ bảo mật"
            placeholder="Tìm thuật ngữ (vd: SQL, payload, IDOR, trace)..."
            className="w-full rounded-large border border-input bg-input py-1.5 pl-9 pr-3 text-sm text-default placeholder:text-subtlest focus:border-focused focus:outline-none focus:ring-2 focus:ring-focused"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo danh mục">
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(tab.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-brand bg-brand-bold text-inverse'
                    : 'border-default bg-surface-raised text-subtle hover:border-brand-subtle hover:text-brand'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
        {entries.length === 0 ? (
          <div className="rounded-xlarge border border-dashed border-default bg-surface-sunken px-4 py-8 text-center">
            <p className="text-sm font-medium text-subtle">
              Không tìm thấy thuật ngữ phù hợp với &ldquo;{query.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
              className="mt-2 rounded-large border border-default bg-surface-raised px-3 py-1 text-xs font-medium text-subtle transition hover:border-brand hover:text-brand"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {entries.map((entry) => (
              <GlossaryItemCard
                key={entry.id}
                entry={entry}
                highlighted={initialTermId === entry.id}
              />
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
