import type { JSX } from 'react';

/** Props shared by the ReviewContent sink in vulnerable.tsx and secure.tsx. */
export interface ReviewContentProps {
  /** Review text exactly as stored in the database (attacker-controlled). */
  content: string;
}

// @snippet:start
/**
 * Render the body of one product review.
 * INTENTIONALLY VULNERABLE: the stored text is inserted into the page as HTML.
 *
 * @param props - Review content as stored in the database.
 * @returns Paragraph containing the review body.
 */
export function ReviewContent({ content }: ReviewContentProps): JSX.Element {
  return (
    <p
      className="text-sm whitespace-pre-line text-slate-700"
      // @step:fe-render-review
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
// @snippet:end
