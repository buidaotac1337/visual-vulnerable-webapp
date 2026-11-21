import { createElement, memo, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { combineVerifyReports, isJavascriptUrl, probeDom, runFrontendVerifyTests } from '@/lib';
import type { SinkModule } from '@/lib';
import type { FrontendVerifyTestCase, VerifyLabResponse, VerifyTestResult } from '@/types';

const PAYLOAD = '<img src=x onerror="window.__vvwaPwned = 1">';

/** Simulates a student's still-vulnerable sink (fixture only; real sinks live in labs/). */
function VulnerableReview({ content }: { content: string }): JSX.Element {
  // eslint-disable-next-line no-restricted-syntax -- test fixture standing in for vulnerable.tsx
  return createElement('p', { dangerouslySetInnerHTML: { __html: content } });
}

/** Simulates the patched sink: React escapes text children. */
function SafeReview({ content }: { content: string }): JSX.Element {
  return <p>{content}</p>;
}

function Exploding(): JSX.Element {
  throw new Error('boom in render');
}

const TEST: FrontendVerifyTestCase = {
  name: 'Payload chỉ hiển thị dạng chữ',
  layer: 'frontend',
  component: 'ReviewContent',
  props: { content: PAYLOAD },
  expect: { activeContent: false, text: { $contains: '<img src=x' } },
};

function parse(html: string): Element {
  return new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html').body
    .firstElementChild as Element;
}

describe('DOM probe', () => {
  it.each([
    ['<script>x()</script>', '<script>'],
    ['<img src=x onerror=alert(1)>', '<img onerror>'],
    ['<a href=" JaVa\tScRiPt:alert(1)">x</a>', '<a href="javascript:">'],
    ['<iframe srcdoc="<b>x</b>"></iframe>', '<iframe>'],
    [
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      '<a xlink:href="javascript:">',
    ],
    ['<form action="javascript:alert(1)"></form>', '<form action="javascript:">'],
  ])('flags %s', (html, finding) => {
    const observation = probeDom(parse(html));
    expect(observation.activeContent).toBe(true);
    expect(observation.findings).toContain(finding);
  });

  it('treats escaped text and plain links as safe', () => {
    const observation = probeDom(parse('&lt;img src=x onerror=1&gt; <a href="/p/1">ok</a>'));
    expect(observation).toMatchObject({ activeContent: false, findings: [] });
    expect(observation.text).toContain('<img src=x onerror=1>');
  });

  it('parses javascript: like a browser', () => {
    expect(isJavascriptUrl('\n java\tscript:alert(1)')).toBe(true);
    expect(isJavascriptUrl('https://example.com/javascript:')).toBe(false);
  });
});

describe('frontend verify runner (inert document)', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__vvwaPwned;
  });

  it('fails a vulnerable sink without executing its payload or touching the page', async () => {
    const sink: SinkModule = { ReviewContent: VulnerableReview };
    const [result] = await runFrontendVerifyTests([TEST], sink);
    expect(result?.passed).toBe(false);
    expect(result?.layer).toBe('frontend');
    expect(result?.actual).toMatchObject({ activeContent: true, findings: ['<img onerror>'] });
    expect((window as unknown as Record<string, unknown>).__vvwaPwned).toBeUndefined();
    expect(document.querySelector('img')).toBeNull();
  });

  it('passes the patched sink that renders the payload as text', async () => {
    const [result] = await runFrontendVerifyTests([TEST], { ReviewContent: SafeReview });
    expect(result).toMatchObject({ passed: true, error: null, action: 'ReviewContent' });
  });

  it('reports render errors, missing exports, and a missing sink module', async () => {
    const [crash] = await runFrontendVerifyTests([TEST], { ReviewContent: Exploding });
    expect(crash?.passed).toBe(false);
    expect(crash?.error).toContain('boom in render');

    const [missing] = await runFrontendVerifyTests([TEST], { Other: SafeReview });
    expect(missing?.error).toContain("'ReviewContent'");

    const [noSink] = await runFrontendVerifyTests([TEST], null);
    expect(noSink?.error).toContain('vulnerable.tsx');
  });

  it('accepts React.memo components and ignores inherited export names', async () => {
    const [memoResult] = await runFrontendVerifyTests([TEST], { ReviewContent: memo(SafeReview) });
    expect(memoResult?.passed).toBe(true);

    const inherited = Object.create({ ReviewContent: SafeReview }) as SinkModule;
    const [protoResult] = await runFrontendVerifyTests([TEST], inherited);
    expect(protoResult?.error).toContain("'ReviewContent'");
  });

  it('waits for useEffect state updates before probing', async () => {
    function EffectText({ content }: { content: string }): JSX.Element {
      const [shown, setShown] = useState('');
      useEffect(() => {
        setShown(content);
      }, [content]);
      return <p>{shown}</p>;
    }
    const [result] = await runFrontendVerifyTests([TEST], { ReviewContent: EffectText });
    expect(result?.actual).toMatchObject({ text: PAYLOAD });
  });

  it('fails an effect-based innerHTML sink instead of passing it before the effect runs', async () => {
    function EffectSink({ content }: { content: string }): JSX.Element {
      const ref = useRef<HTMLDivElement | null>(null);
      useEffect(() => {
        if (ref.current) {
          // eslint-disable-next-line no-restricted-syntax -- test fixture standing in for vulnerable.tsx
          ref.current.innerHTML = content;
        }
      }, [content]);
      return <div ref={ref} />;
    }
    const [result] = await runFrontendVerifyTests([TEST], { ReviewContent: EffectSink });
    expect(result?.passed).toBe(false);
    expect(result?.actual).toMatchObject({ activeContent: true });
    expect((window as unknown as Record<string, unknown>).__vvwaPwned).toBeUndefined();
  });

  it('reports malformed operators as a failed test instead of throwing', async () => {
    const badTest = { ...TEST, expect: { text: { $regex: 'x' } } };
    const [result] = await runFrontendVerifyTests([badTest], { ReviewContent: SafeReview });
    expect(result?.passed).toBe(false);
    expect(result?.error).toContain('$regex');
  });
});

describe('combineVerifyReports', () => {
  const backend: VerifyLabResponse = {
    ok: true,
    lab_id: '02-xss',
    passed: true,
    total: 1,
    passed_count: 1,
    results: [
      { name: 'b', action: 'post_review', passed: true, expected: {}, actual: {}, error: null },
    ],
  };
  const frontendPass: VerifyTestResult = {
    name: TEST.name,
    action: 'ReviewContent',
    layer: 'frontend',
    passed: true,
    expected: {},
    actual: {},
    error: null,
  };

  it('passes only when both layers pass', () => {
    const combined = combineVerifyReports('02-xss', backend, [frontendPass], false);
    expect(combined).toMatchObject({ passed: true, total: 2, passed_count: 2 });
  });

  it('fails when the backend request errored even if frontend tests pass', () => {
    const combined = combineVerifyReports('02-xss', null, [frontendPass], true);
    expect(combined).toMatchObject({ ok: false, passed: false, total: 1, passed_count: 1 });
  });

  it('never passes an empty report', () => {
    expect(combineVerifyReports('02-xss', null, [], false).passed).toBe(false);
  });
});
