import { createElement } from 'react';
import type { ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { probeDom } from '@/lib';
import type { TraceStepDraft } from '@/types';

/** The ReviewContent sink exported by frontend/vulnerable.tsx and frontend/secure.tsx. */
export type ReviewBodyComponent = ComponentType<{ content: string }>;

/** One review row returned by list_reviews / post_review. */
export interface ReviewRecord {
  id: number;
  username: string;
  rating: number;
  content: string;
}

/** Product option shown in the product selector. */
export interface ProductOption {
  id: number;
  name: string;
}

/** Product page data shared by every Lab 02 action response. */
export interface ReviewPage {
  productId: number;
  products: ProductOption[];
  reviews: ReviewRecord[];
}

const MARKUP_RE = /<\s*[a-zA-Z!/?]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toReview(value: unknown): ReviewRecord | null {
  if (!isRecord(value) || typeof value.content !== 'string') {
    return null;
  }
  return {
    id: Number(value.id),
    username: String(value.username ?? ''),
    rating: Number(value.rating),
    content: value.content,
  };
}

function toProduct(value: unknown): ProductOption | null {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null;
  }
  return { id: Number(value.id), name: value.name };
}

/**
 * Check whether text contains something a browser would parse as an HTML tag.
 *
 * @param text - Review content.
 * @returns True when the content contains HTML-like markup.
 */
export function hasMarkup(text: string): boolean {
  return MARKUP_RE.test(text);
}

/**
 * Read the product page from a Lab 02 response `data` object.
 *
 * @param data - Response data, or undefined.
 * @returns Parsed page, or null when the response carries no review list.
 */
export function readReviewPage(data: Record<string, unknown> | undefined): ReviewPage | null {
  if (!data || !Array.isArray(data.reviews)) {
    return null;
  }
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    productId: Number(data.product_id ?? 1),
    products: products.map(toProduct).filter((item) => item !== null),
    reviews: data.reviews.map(toReview).filter((item) => item !== null),
  };
}

/**
 * Render one review with the active sink and list markup that could execute.
 *
 * Rendering goes through react-dom (like the Test My Fix grader), so React Refresh
 * resolves the sink to the code the user just saved. The container lives in a
 * document without a browsing context: nothing in it runs or loads. It uses
 * flushSync, so call it from a separate task, never during a React render or commit.
 *
 * @param ReviewBody - ReviewContent component of the active mode.
 * @param content - Stored review text.
 * @returns Findings such as `<img onerror>`; empty when the output is inert.
 */
export function findActiveContent(ReviewBody: ReviewBodyComponent, content: string): string[] {
  const inertDoc = document.implementation.createHTMLDocument('');
  const container = inertDoc.createElement('div');
  inertDoc.body.appendChild(container);
  const root = createRoot(container, { onUncaughtError: () => undefined });
  try {
    flushSync(() => {
      root.render(createElement(ReviewBody, { content }));
    });
    return probeDom(container).findings;
  } finally {
    root.unmount();
  }
}

/**
 * Describe how the active ReviewContent sink rendered the returned reviews.
 *
 * @param page - Page returned by the backend, or null.
 * @param findingsById - Active-content findings per review id.
 * @returns Frontend trace steps appended after the backend trace.
 */
export function buildRenderSteps(
  page: ReviewPage | null,
  findingsById: ReadonlyMap<number, readonly string[]>,
): TraceStepDraft[] {
  if (!page) {
    return [];
  }
  const marked = page.reviews.filter((review) => hasMarkup(review.content));
  const executable = page.reviews.filter(
    (review) => (findingsById.get(review.id) ?? []).length > 0,
  );
  const first = executable[0];
  if (first) {
    const findings = (findingsById.get(first.id) ?? []).join(', ');
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-review',
        status: 'danger',
        title: 'ReviewContent dựng nội dung đánh giá thành HTML thật',
        detail: `${String(executable.length)} đánh giá tạo ra mã thực thi được (${findings}): ${first.content}`,
      },
    ];
  }
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-review',
      status: marked.length > 0 ? 'safe' : 'info',
      title: marked.length > 0 ? 'ReviewContent hiển thị HTML dưới dạng chữ' : 'Hiển thị đánh giá',
      detail:
        marked.length > 0
          ? `${String(marked.length)} đánh giá chứa HTML được escape, hiển thị nguyên văn.`
          : `${String(page.reviews.length)} đánh giá, không có nội dung HTML.`,
    },
  ];
}

/**
 * Inspect every review of a page with the active sink component.
 *
 * @param page - Product page, or null.
 * @param ReviewBody - ReviewContent component of the active mode.
 * @returns Findings per review id (only reviews containing markup are rendered).
 */
export function analyzePage(
  page: ReviewPage | null,
  ReviewBody: ReviewBodyComponent,
): Map<number, string[]> {
  const result = new Map<number, string[]>();
  for (const review of page?.reviews ?? []) {
    if (hasMarkup(review.content)) {
      result.set(review.id, findActiveContent(ReviewBody, review.content));
    }
  }
  return result;
}
