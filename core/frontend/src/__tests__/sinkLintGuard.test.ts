// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Repository root as a filesystem path (the lint script runs ESLint from there).
 * Derived from import.meta.url instead of node:url/fileURLToPath because the app
 * tsconfig intentionally excludes Node typings.
 */
function repoRoot(): string {
  const pathname = decodeURIComponent(new URL('../../../../', import.meta.url).pathname);
  return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname;
}

const ROOT = repoRoot();
// One shared instance: building ESLint (and loading its flat config) per call is slow.
const ESLINT = new ESLint({
  cwd: ROOT,
  overrideConfigFile: `${ROOT}core/frontend/eslint.config.js`,
});

const SINK_SNIPPETS: Record<string, string> = {
  jsx: 'export const A = (p: { h: string }) => <div dangerouslySetInnerHTML={{ __html: p.h }} />;\n',
  innerHTML: 'export function a(el: HTMLElement, h: string): void {\n  el.innerHTML = h;\n}\n',
  outerHTML: 'export function a(el: HTMLElement, h: string): void {\n  el.outerHTML = h;\n}\n',
  createElementProps:
    "import { createElement } from 'react';\nexport const A = (h: string) => createElement('div', { dangerouslySetInnerHTML: { __html: h } });\n",
  insertAdjacentHTML:
    "export function a(el: HTMLElement, h: string): void {\n  el.insertAdjacentHTML('beforeend', h);\n}\n",
};

async function restrictedSyntaxMessages(code: string, relativePath: string): Promise<string[]> {
  const [result] = await ESLINT.lintText(code, { filePath: `${ROOT}${relativePath}` });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message);
}

async function restrictedSyntaxErrors(code: string, relativePath: string): Promise<number> {
  return (await restrictedSyntaxMessages(code, relativePath)).length;
}

describe('ADR-0006 sink lint guard', () => {
  it.each(Object.entries(SINK_SNIPPETS))(
    'blocks %s outside vulnerable.tsx',
    async (_name, code) => {
      expect(await restrictedSyntaxErrors(code, 'core/frontend/src/components/Bad.tsx')).toBe(1);
      expect(await restrictedSyntaxErrors(code, 'labs/99-demo/frontend/LabView.tsx')).toBe(1);
      expect(await restrictedSyntaxErrors(code, 'labs/99-demo/frontend/secure.tsx')).toBe(1);
    },
  );

  it.each(Object.entries(SINK_SNIPPETS))(
    'allows %s in labs/<id>/frontend/vulnerable.tsx',
    async (_name, code) => {
      expect(await restrictedSyntaxErrors(code, 'labs/99-demo/frontend/vulnerable.tsx')).toBe(0);
    },
  );

  it('still allows reading innerHTML (used by the DOM probe)', async () => {
    const reader = 'export function a(el: HTMLElement): string {\n  return el.innerHTML;\n}\n';
    expect(await restrictedSyntaxErrors(reader, 'core/frontend/src/lib/probe.ts')).toBe(0);
  });
});

describe('Design system colour guard', () => {
  // Built at run time so this test file itself does not contain a raw palette class.
  const [red, emerald, amber] = [
    ['text', 'red', '600'],
    ['bg', 'emerald', '50'],
    ['bg', 'amber', '500'],
  ].map((p) => p.join('-'));
  const rawTemplate = `export const A = () => <p className={\`p-2 \${'${red}'} ${emerald}\`} />;\n`;
  const rawJsxAttr = `export const A = () => <p className="${amber}" />;\n`;
  const allowed =
    'export const A = () => <p className={`p-2 ${\'text-danger-600\'} bg-safe-50 bg-slate-500 text-sky-100 border-violet-800 text-yellow-400`} data-id="order-red-1" data-sku="shirt-blue-2" />;\n';

  it('blocks raw palette colours in literals, template chunks, and JSX attributes everywhere', async () => {
    expect(await restrictedSyntaxErrors(rawTemplate, 'core/frontend/src/components/Bad.tsx')).toBe(
      2,
    );
    expect(await restrictedSyntaxErrors(rawTemplate, 'labs/99-demo/frontend/vulnerable.tsx')).toBe(
      2,
    );

    const jsxMessages = await restrictedSyntaxMessages(
      rawJsxAttr,
      'core/frontend/src/components/Bad.tsx',
    );
    expect(jsxMessages).toHaveLength(1);
    expect(jsxMessages[0]).toContain('Use semantic colour tokens');
  });

  it('allows semantic roles, neutral/secondary palettes, and non-Tailwind ID strings', async () => {
    expect(await restrictedSyntaxErrors(allowed, 'labs/99-demo/frontend/LabView.tsx')).toBe(0);
  });
});
