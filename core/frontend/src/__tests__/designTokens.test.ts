import { describe, expect, it } from 'vitest';

import indexHtml from '../../index.html?raw';
import foundationsCss from '@/styles/tokens/foundations.css?raw';
import paletteCss from '@/styles/tokens/palette.css?raw';
import tailwindThemeCss from '@/styles/tokens/tailwind-theme.css?raw';
import themeDarkCss from '@/styles/tokens/theme-dark.css?raw';
import themeLightCss from '@/styles/tokens/theme-light.css?raw';
import { COLOR_MODE_STORAGE_KEY, DEFAULT_COLOR_MODE } from '@/hooks';
import { TONE_CLASSES, TRACE_OUTCOME_TONE, TRACE_STATUS_TONE, WORKSPACE_MODE_TONE } from '@/lib';

/** Fail loudly on an empty CSS source (Vitest empties CSS imports outside `test.css.include`). */
function nonEmpty(names: string[], what: string): string[] {
  if (names.length === 0) {
    throw new Error(`No ${what} found: is the CSS source empty?`);
  }
  return names;
}

function declared(css: string, prefix: string): Set<string> {
  const names = css.match(new RegExp(`${prefix}[a-z0-9-]+(?=\\s*:)`, 'g')) ?? [];
  return new Set(nonEmpty(names, `${prefix}* declarations`));
}

function referenced(css: string, prefix: string): Set<string> {
  const names = css.match(new RegExp(`var\\((${prefix}[a-z0-9-]+)\\)`, 'g')) ?? [];
  return new Set(nonEmpty(names, `var(${prefix}*) references`).map((name) => name.slice(4, -1)));
}

const NAMESPACE_BY_UTILITY: Record<string, string> = {
  text: '--text-color-',
  bg: '--background-color-',
  border: '--border-color-',
};

/** Theme variable a token utility class resolves through, e.g. bg-danger → --background-color-danger. */
function themeVariableFor(className: string): string {
  const [utility = '', ...rest] = className.split('-');
  const namespace = NAMESPACE_BY_UTILITY[utility];
  if (!namespace) {
    throw new Error(`Unexpected utility in tone map: ${className}`);
  }
  return `${namespace}${rest.join('-')}`;
}

describe('Design tokens SSOT (ADR-0012)', () => {
  it('declares the same semantic tokens for light and dark', () => {
    const light = [...declared(themeLightCss, '--vv-')].sort();
    const dark = [...declared(themeDarkCss, '--vv-')].sort();
    expect(light.length).toBeGreaterThan(100);
    expect(dark).toEqual(light);
  });

  it('builds themes only from palette variables', () => {
    const palette = declared(paletteCss, '--vv-');
    for (const css of [themeLightCss, themeDarkCss]) {
      for (const name of referenced(css, '--vv-')) {
        expect(palette.has(name), name).toBe(true);
      }
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });

  it('maps every utility and derived token to a declared semantic token', () => {
    const semantic = new Set([
      ...declared(themeLightCss, '--vv-'),
      ...declared(foundationsCss, '--vv-'),
    ]);
    for (const css of [tailwindThemeCss, foundationsCss]) {
      for (const name of referenced(css, '--vv-')) {
        expect(semantic.has(name), name).toBe(true);
      }
    }
  });

  it('backs every tone class with a generated utility', () => {
    for (const [tone, classes] of Object.entries(TONE_CLASSES)) {
      for (const className of Object.values(classes)) {
        expect(tailwindThemeCss, `${tone}: ${className}`).toContain(
          `${themeVariableFor(className)}:`,
        );
      }
    }
  });

  it('gives every trace status, outcome, and workspace mode a tone', () => {
    expect(Object.keys(TRACE_STATUS_TONE).sort()).toEqual(['danger', 'info', 'safe', 'warning']);
    expect(Object.keys(TRACE_OUTCOME_TONE).sort()).toEqual([
      'blocked',
      'error',
      'exploited',
      'normal',
    ]);
    expect(Object.keys(WORKSPACE_MODE_TONE).sort()).toEqual(['compare', 'secure', 'vulnerable']);
  });

  it('keeps index.html offline and in sync with the colour-mode hook', () => {
    expect(indexHtml).not.toMatch(/https?:\/\//);
    expect(indexHtml).toContain(`getItem('${COLOR_MODE_STORAGE_KEY}') || '${DEFAULT_COLOR_MODE}'`);
    expect(indexHtml).toContain(`data-color-mode="${DEFAULT_COLOR_MODE}"`);
  });
});
