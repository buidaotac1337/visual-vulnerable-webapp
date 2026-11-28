import type { JSX } from 'react';

/** Props shared by the ReviewContent sink in vulnerable.tsx and secure.tsx. */
export interface ReviewContentProps {
  /** Review text exactly as stored in the database (attacker-controlled). */
  content: string;
}

// @snippet:start
/**
 * Render the body of one product review.
 * SECURE: the stored text is rendered as a text node, so React escapes it.
 *
 * @param props - Review content as stored in the database.
 * @returns Paragraph containing the review body.
 */
export function ReviewContent({ content }: ReviewContentProps): JSX.Element {
  // @step:fe-render-review
  return <p className="text-sm whitespace-pre-line text-subtle">{content}</p>;
}
// @snippet:end
