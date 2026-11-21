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

async function sinkErrors(code: string, relativePath: string): Promise<number> {
  const [result] = await ESLINT.lintText(code, { filePath: `${ROOT}${relativePath}` });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax').length;
}

describe('ADR-0006 sink lint guard', () => {
  it.each(Object.entries(SINK_SNIPPETS))(
    'blocks %s outside vulnerable.tsx',
    async (_name, code) => {
      expect(await sinkErrors(code, 'core/frontend/src/components/Bad.tsx')).toBe(1);
      expect(await sinkErrors(code, 'labs/99-demo/frontend/LabView.tsx')).toBe(1);
      expect(await sinkErrors(code, 'labs/99-demo/frontend/secure.tsx')).toBe(1);
    },
  );

  it.each(Object.entries(SINK_SNIPPETS))(
    'allows %s in labs/<id>/frontend/vulnerable.tsx',
    async (_name, code) => {
      expect(await sinkErrors(code, 'labs/99-demo/frontend/vulnerable.tsx')).toBe(0);
    },
  );

  it('still allows reading innerHTML (used by the DOM probe)', async () => {
    const reader = 'export function a(el: HTMLElement): string {\n  return el.innerHTML;\n}\n';
    expect(await sinkErrors(reader, 'core/frontend/src/lib/probe.ts')).toBe(0);
  });
});

describe('Design system colour guard', () => {
  // Built at run time so this test file itself does not contain a raw palette class.
  const [red, emerald] = [
    ['text', 'red', '600'],
    ['bg', 'emerald', '50'],
  ].map((p) => p.join('-'));
  const raw = `export const A = () => <p className={\`p-2 \${'${red}'} ${emerald}\`} />;\n`;
  const semantic =
    "export const A = () => <p className={`p-2 ${'text-danger-600'} bg-safe-50`} />;\n";

  it('blocks raw palette colours everywhere, vulnerable.tsx included', async () => {
    // One string literal and one template chunk carry a raw palette class.
    expect(await sinkErrors(raw, 'core/frontend/src/components/Bad.tsx')).toBe(2);
    expect(await sinkErrors(raw, 'labs/99-demo/frontend/vulnerable.tsx')).toBe(2);
  });

  it('allows the semantic colour roles', async () => {
    expect(await sinkErrors(semantic, 'labs/99-demo/frontend/LabView.tsx')).toBe(0);
  });
});
