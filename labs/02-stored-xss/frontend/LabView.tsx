import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Eye, MessageSquarePlus, ShoppingBag } from 'lucide-react';

import { LabCard, PrimaryButton, SubTabBar } from '@/components';
import type { SubTabItem } from '@/components';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabPayload,
  LabViewProps,
  TraceStepDraft,
} from '@/types';

import { WriteReviewForm } from './ReviewForm';
import { ReviewList } from './ReviewList';
import { analyzePage, buildRenderSteps, readReviewPage } from './reviewData';
import type { ProductOption, ReviewBodyComponent, ReviewPage } from './reviewData';
import { ReviewContent as SecureReviewContent } from './secure';
import { ReviewContent as VulnerableReviewContent } from './vulnerable';

type SubTab = 'view' | 'write';

const LAB_ID = '02-stored-xss';
const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none';
const DEFAULT_PRODUCTS: readonly ProductOption[] = [1, 2, 3].map((id) => ({
  id,
  name: `Sản phẩm #${String(id)}`,
}));
const TAB_ITEMS: readonly SubTabItem<SubTab>[] = [
  {
    id: 'view',
    label: 'Xem sản phẩm',
    icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    id: 'write',
    label: 'Viết đánh giá',
    icon: <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />,
  },
];
function readNumber(payload: LabPayload, key: string, fallback: number): number {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : fallback;
}

function readString(payload: LabPayload, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function readSaveError(response: LabExecutionResponse | null): string | null {
  const error = response?.data.saved === false ? response.data.error : null;
  return typeof error === 'string' ? error : null;
}

function renderStepsFor(
  ReviewBody: ReviewBodyComponent,
): (response: LabExecutionResponse) => TraceStepDraft[] {
  return (response) => {
    const page = readReviewPage(response.data);
    return buildRenderSteps(page, analyzePage(page, ReviewBody));
  };
}

/** Keep the product page in sync: silent reload on product/mode/DB reset, then each response. */
function useReviewPage(props: LabViewProps, productId: number): ReviewPage | null {
  const { mode, dbResetSeq, lastResponse, onExecute } = props;
  const [page, setPage] = useState<ReviewPage | null>(null);
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef
      .current('list_reviews', { product_id: productId }, { silent: true })
      .then((response) => {
        const next = readReviewPage(response?.data);
        if (active && next) {
          setPage(next);
        }
      });
    return () => {
      active = false;
    };
  }, [productId, mode, dbResetSeq]);

  useEffect(() => {
    const next = readReviewPage(lastResponse?.data);
    if (next) {
      setPage(next);
    }
  }, [lastResponse]);

  return page;
}

/**
 * Interactive MiniShop product page for Lab 02 (Stored XSS in product reviews).
 * The review body is rendered by the ReviewContent sink of the active mode.
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered MiniShop product page with review list and review form.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const activeTab: SubTab = payload.tab === 'write' ? 'write' : 'view';
  const productId = readNumber(payload, 'product_id', 1);
  const rating = readNumber(payload, 'rating', 5);
  const content = readString(payload, 'content');
  const ReviewBody = mode === 'vulnerable' ? VulnerableReviewContent : SecureReviewContent;
  const page = useReviewPage(props, productId);
  const [findingsById, setFindingsById] = useState<ReadonlyMap<number, string[]>>(new Map());
  useEffect(() => {
    // analyzePage uses flushSync on a separate root, which React forbids mid-commit.
    const timer = window.setTimeout(() => {
      setFindingsById(analyzePage(page, ReviewBody));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [page, ReviewBody]);
  const products = page?.products.length ? page.products : DEFAULT_PRODUCTS;
  const update = (patch: LabPayload): void => onPayloadChange({ ...payload, ...patch });

  // @snippet:start
  const options = (before: TraceStepDraft): ExecuteActionOptions => ({
    frontendStepsBefore: [before],
    frontendStepsAfter: renderStepsFor(ReviewBody),
  });

  const handleView = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // @step:fe-load-reviews
    void props.onExecute(
      'list_reviews',
      { product_id: productId },
      options({
        layer: 'frontend',
        tag: 'fe-load-reviews',
        status: 'info',
        title: 'Mở trang sản phẩm MiniShop',
        detail: `POST /api/labs/${LAB_ID}/${mode}/list_reviews với product_id=${String(productId)}, người xem: ${actor ?? 'ẩn danh'}`,
      }),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // @step:fe-submit-review
    void props.onExecute(
      'post_review',
      { product_id: productId, rating, content },
      options({
        layer: 'frontend',
        tag: 'fe-submit-review',
        status: 'info',
        title: 'Gửi đánh giá sản phẩm',
        detail: `POST /api/labs/${LAB_ID}/${mode}/post_review với content=${JSON.stringify(content)}`,
      }),
    );
  };
  // @snippet:end

  return (
    <LabCard
      title="MiniShop · Trang sản phẩm"
      icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
      headerRight={
        <SubTabBar
          ariaLabel="Tính năng MiniShop Lab 02"
          items={TAB_ITEMS}
          activeId={activeTab}
          onChange={(tab) => update({ tab })}
        />
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="xss-product" className="text-xs font-medium text-slate-700">
          Sản phẩm
        </label>
        <select
          id="xss-product"
          value={productId}
          onChange={(event) => update({ product_id: Number(event.target.value) })}
          className={SELECT_CLASS}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'view' ? (
        <form onSubmit={handleView} className="flex flex-col gap-3">
          <PrimaryButton
            type="submit"
            icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            isBusy={isExecuting}
            busyLabel="Đang tải..."
            className="self-start"
          >
            Mở trang sản phẩm
          </PrimaryButton>
        </form>
      ) : (
        <WriteReviewForm
          rating={rating}
          content={content}
          inputFlashSeq={inputFlashSeq}
          isExecuting={isExecuting}
          saveError={readSaveError(lastResponse)}
          onChange={update}
          onSubmit={handleSubmit}
        />
      )}

      <ReviewList page={page} ReviewBody={ReviewBody} findingsById={findingsById} />
    </LabCard>
  );
}
