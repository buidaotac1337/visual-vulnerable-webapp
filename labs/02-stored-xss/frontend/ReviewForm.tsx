import type { FormEvent, JSX } from 'react';
import { Send } from 'lucide-react';

import type { LabPayload } from '@/types';

/** Shared input style of the Lab 02 forms. */
export const INPUT_CLASS =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none';
/** Shared primary button style of the Lab 02 forms. */
export const BUTTON_CLASS =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

interface WriteReviewFormProps {
  rating: number;
  content: string;
  inputFlashSeq: number;
  isExecuting: boolean;
  saveError: string | null;
  onChange: (patch: LabPayload) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Review form: rating and content of the review being written.
 *
 * @param props - Current form values, flags, and callbacks from LabView.
 * @returns Form element submitting post_review.
 */
export function WriteReviewForm(props: WriteReviewFormProps): JSX.Element {
  const { rating, content, inputFlashSeq, isExecuting, saveError, onChange, onSubmit } = props;
  const flashClass = inputFlashSeq > 0 ? 'vvwa-input-flash' : '';
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="xss-rating" className="text-xs font-medium text-slate-700">
          Điểm đánh giá (1–5)
        </label>
        <input
          key={`r-${String(inputFlashSeq)}`}
          id="xss-rating"
          type="number"
          value={rating}
          onChange={(event) => onChange({ rating: Number(event.target.value) })}
          className={`${INPUT_CLASS} w-24 ${flashClass}`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="xss-content" className="text-xs font-medium text-slate-700">
          Nội dung đánh giá
        </label>
        <textarea
          key={`c-${String(inputFlashSeq)}`}
          id="xss-content"
          rows={3}
          spellCheck={false}
          value={content}
          onChange={(event) => onChange({ content: event.target.value })}
          placeholder='Ví dụ: Gõ rất êm! hoặc <img src=x onerror="...">'
          className={`${INPUT_CLASS} ${flashClass}`}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>
      <button type="submit" disabled={isExecuting} className={BUTTON_CLASS}>
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isExecuting ? 'Đang gửi...' : 'Gửi đánh giá'}</span>
      </button>
      {saveError && (
        <p role="alert" className="text-xs font-medium text-amber-700">
          {saveError}
        </p>
      )}
    </form>
  );
}
