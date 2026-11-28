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

describe('Design token lint guard (ADR-0012)', () => {
  // Bad classes are assembled at run time so this file does not trip the rules itself.
  const join = (...parts: string[]): string => parts.join('-');
  const BLOCKED: Record<string, string> = {
    defaultPalette: join('text', 'red', '600'),
    neutralPalette: join('bg', 'slate', '50'),
    removedRoleScale: join('bg', 'danger', '50'),
    removedSafeScale: join('text', 'safe', '700'),
    removedSoftTint: join('bg', 'info', 'soft'),
    white: join('text', 'white'),
    arbitraryColour: join('bg', '[#fff]'),
    arbitraryVar: join('border', '[var(--x)]'),
    arbitraryFontSize: join('text', '[11px]'),
    arbitrarySpacing: join('px', '[3px]'),
  };

  it.each(Object.entries(BLOCKED))(
    'blocks %s in core, LabView and the vulnerable sink',
    async (_name, cls) => {
      const attr = `export const A = () => <p className="p-2 ${cls}" />;\n`;
      const template = `export const A = (x: string) => <p className={\`p-2 \${x} ${cls}\`} />;\n`;
      expect(await restrictedSyntaxErrors(attr, 'core/frontend/src/components/Bad.tsx')).toBe(1);
      expect(await restrictedSyntaxErrors(template, 'labs/99-demo/frontend/LabView.tsx')).toBe(1);
      expect(await restrictedSyntaxErrors(attr, 'labs/99-demo/frontend/vulnerable.tsx')).toBe(1);
    },
  );

  it('blocks inline fontFamily styles', async () => {
    const code = "export const A = () => <p style={{ fontFamily: 'monospace' }} />;\n";
    const messages = await restrictedSyntaxMessages(code, 'core/frontend/src/components/Bad.tsx');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('font-mono');
  });

  it('allows purpose tokens, layout arbitrary values, and non-Tailwind ID strings', async () => {
    const allowed =
      'export const A = () => <p className="text-subtle bg-danger-bold border-success-subtle text-micro font-mono px-0.75 max-w-[190px] min-[112.5rem]:inline bg-transparent text-icon-accent-yellow" data-id="order-red-1" data-sku="shirt-blue-2" />;\n';
    expect(await restrictedSyntaxErrors(allowed, 'labs/99-demo/frontend/LabView.tsx')).toBe(0);
  });
});
