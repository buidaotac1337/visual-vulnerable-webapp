import type { FormEvent, JSX } from 'react';
import { Send } from 'lucide-react';

import { PrimaryButton, ResultNotice, TextField } from '@/components';
import type { LabPayload } from '@/types';

const TEXTAREA_CLASS =
  'rounded-large border border-input px-3 py-2 text-sm text-default focus:border-focused focus:outline-none';

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
    // noValidate: min/max only guide the spinner; out-of-range values still reach the
    // backend so students can see the server-side check reject them.
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <TextField
        id="xss-rating"
        label="Điểm đánh giá (1–5)"
        type="number"
        min={1}
        max={5}
        value={rating}
        onChange={(value) => onChange({ rating: Number(value) })}
        flashSeq={inputFlashSeq}
        inputClassName="w-24"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="xss-content" className="text-xs font-medium text-subtle">
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
          className={`${TEXTAREA_CLASS} ${flashClass} font-mono`}
        />
      </div>
      <PrimaryButton
        type="submit"
        icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
        isBusy={isExecuting}
        busyLabel="Đang gửi..."
        className="self-start"
      >
        Gửi đánh giá
      </PrimaryButton>
      {saveError && <ResultNotice tone="warning">{saveError}</ResultNotice>}
    </form>
  );
}
