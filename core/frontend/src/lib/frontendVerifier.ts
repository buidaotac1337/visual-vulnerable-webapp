import { createElement } from 'react';
import type { ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { FrontendVerifyTestCase, VerifyLabResponse, VerifyTestResult } from '@/types';

import { probeDom } from './domProbe';
import type { DomObservation } from './domProbe';
import { matchesExpected } from './expectMatcher';

/** Namespace object of a lab's frontend/vulnerable.tsx module. */
export type SinkModule = Readonly<Record<string, unknown>>;

type AnyComponent = ComponentType<Record<string, unknown>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Render a component into a detached, inert document and probe the result.
 *
 * The document comes from `document.implementation.createHTMLDocument`, which has
 * no browsing context: scripts never run, resources never load, and inline event
 * handlers never fire. The container is never attached to the live page, so a
 * still-vulnerable sink cannot execute its payload while being graded.
 *
 * `flushSync` only commits the render; passive effects (`useEffect`) and the state
 * updates they schedule run on later macrotasks. Sinks written as
 * `useEffect(() => { ref.current.innerHTML = html })` would otherwise be probed
 * before they write, and pass while still vulnerable — so the runner yields a few
 * macrotasks until the DOM settles before probing.
 *
 * @param component - React component exported by frontend/vulnerable.tsx.
 * @param props - Props from the verifyTests entry.
 * @returns DomObservation of the settled subtree.
 * @throws The first uncaught render or effect error raised by the component.
 */
export async function renderInInertDocument(
  component: AnyComponent,
  props: Record<string, unknown>,
): Promise<DomObservation> {
  const inertDoc = document.implementation.createHTMLDocument('');
  const container = inertDoc.createElement('div');
  inertDoc.body.appendChild(container);
  let renderError: unknown = null;
  const root = createRoot(container, {
    onUncaughtError: (error) => {
      renderError ??= error;
    },
  });
  try {
    flushSync(() => {
      root.render(createElement(component, props));
    });
    await settleEffects(container);
    if (renderError !== null) {
      throw renderError instanceof Error ? renderError : new Error(String(renderError));
    }
    return probeDom(container);
  } finally {
    root.unmount();
  }
}

/** Upper bound on macrotask yields while waiting for effects to stop changing the DOM. */
const MAX_SETTLE_ROUNDS = 10;

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function settleEffects(container: Element): Promise<void> {
  // Reading innerHTML is allowed; it is only compared, never written back.
  let previous = container.innerHTML;
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    await nextMacrotask();
    const current = container.innerHTML;
    if (round > 0 && current === previous) {
      return;
    }
    previous = current;
  }
}

/**
 * Mark every frontend test as failed with the same error (e.g. the sink module failed to load).
 *
 * @param tests - Frontend verifyTests from meta.json.
 * @param error - Diagnostic shown to the student.
 * @returns Failed VerifyTestResult per test.
 */
export function failFrontendVerifyTests(
  tests: readonly FrontendVerifyTestCase[],
  error: string,
): VerifyTestResult[] {
  return tests.map((test) => failedResult(test, error));
}

/**
 * Accept function/class components and React wrapper objects such as React.memo or
 * forwardRef (objects tagged with $$typeof).
 *
 * @param value - Export looked up in vulnerable.tsx.
 * @returns True when the value can be passed to createElement as a component.
 */
function isRenderableComponent(value: unknown): value is AnyComponent {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

function failedResult(test: FrontendVerifyTestCase, error: string): VerifyTestResult {
  return {
    name: test.name,
    action: test.component,
    layer: 'frontend',
    passed: false,
    expected: test.expect,
    actual: {},
    error,
  };
}

async function runOne(
  test: FrontendVerifyTestCase,
  sink: SinkModule | null,
): Promise<VerifyTestResult> {
  if (!sink) {
    return failedResult(test, 'Lab chưa có cặp frontend/vulnerable.tsx + secure.tsx.');
  }
  const component = Object.hasOwn(sink, test.component) ? sink[test.component] : undefined;
  if (!isRenderableComponent(component)) {
    return failedResult(test, `Không tìm thấy component '${test.component}' trong vulnerable.tsx.`);
  }
  try {
    const observation = await renderInInertDocument(component, test.props);
    const actual = { ...observation };
    return {
      name: test.name,
      action: test.component,
      layer: 'frontend',
      passed: matchesExpected(test.expect, actual),
      expected: test.expect,
      actual,
      error: null,
    };
  } catch (error: unknown) {
    return failedResult(test, errorMessage(error));
  }
}

/**
 * Grade frontend verifyTests against the student's frontend/vulnerable.tsx module.
 *
 * @param tests - Frontend verifyTests from meta.json.
 * @param sink - Loaded vulnerable.tsx module, or null when the lab has no sink pair.
 * @returns One VerifyTestResult per test, in order (tests run one after another).
 */
export async function runFrontendVerifyTests(
  tests: readonly FrontendVerifyTestCase[],
  sink: SinkModule | null,
): Promise<VerifyTestResult[]> {
  const results: VerifyTestResult[] = [];
  for (const test of tests) {
    results.push(await runOne(test, sink));
  }
  return results;
}

/**
 * Merge the backend verify report (if any) with locally graded frontend results.
 * The lab passes only when every test of both layers ran and passed.
 *
 * @param labId - Lab identifier.
 * @param backend - Report from POST /api/labs/{id}/verify, or null if not run/failed.
 * @param frontend - Results of runFrontendVerifyTests.
 * @param backendFailed - True when the backend request errored (forces a fail).
 * @returns Combined VerifyLabResponse for VerifyModal.
 */
export function combineVerifyReports(
  labId: string,
  backend: VerifyLabResponse | null,
  frontend: readonly VerifyTestResult[],
  backendFailed: boolean,
): VerifyLabResponse {
  const results = [...(backend?.results ?? []), ...frontend];
  const passedCount = results.filter((item) => item.passed).length;
  return {
    ok: !backendFailed,
    lab_id: labId,
    passed: !backendFailed && results.length > 0 && passedCount === results.length,
    total: results.length,
    passed_count: passedCount,
    results,
  };
}
