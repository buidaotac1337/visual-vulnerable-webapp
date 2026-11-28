import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ADR-0006: intentional HTML sinks may only live in labs/<id>/frontend/vulnerable.tsx.
 * Reading innerHTML (e.g. in the DOM probe) stays allowed; only writes are banned.
 */
const SINK_RESTRICTIONS = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message:
      'dangerouslySetInnerHTML is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
  },
  {
    selector:
      "Property[key.name='dangerouslySetInnerHTML'], Property[key.value='dangerouslySetInnerHTML']",
    message:
      'dangerouslySetInnerHTML (e.g. via createElement props) is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
  },
  {
    selector:
      'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]',
    message:
      'Writing innerHTML/outerHTML is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
  },
];

/**
 * Design tokens SSOT (ADR-0012): colours, type sizes and spacing come from the --vv-* tokens in
 * src/styles/tokens/ (text-subtle, bg-danger-bold, border-default, text-body-small...). Tailwind's
 * default palette is removed from the theme, so these rules catch classes that would otherwise
 * silently render nothing, plus inline values that bypass the tokens.
 */
const TOKEN_DOC = 'Use the design tokens instead (docs/design-system.md, ADR-0012).';
const CLASS_PATTERNS = [
  {
    regex: String.raw`/-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)\b/`,
    message: `Tailwind's default palette is not part of the theme. ${TOKEN_DOC}`,
  },
  {
    regex: String.raw`/-(danger|safe|warning|info|brand)-(50|[1-9]00|950|soft)\b/`,
    message: `The danger/safe/warning/info/brand shade scales were removed; use purpose tokens such as text-danger, bg-danger-bold, border-success-subtle. ${TOKEN_DOC}`,
  },
  {
    regex: String.raw`/(^|[\s:])(bg|text|border|ring|fill|stroke|divide|outline|from|via|to)-(white|black)\b/`,
    message: `Use text-inverse, bg-surface-raised or another token instead of white/black. ${TOKEN_DOC}`,
  },
  {
    regex: String.raw`/(^|[\s:])-?(([a-z]+-)+\[(#|rgb|hsl|oklch|color-mix|var\()|(text|leading)-\[\d|(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy])-\[)/`,
    message: `Arbitrary colour, font-size, line-height or spacing values bypass the tokens. ${TOKEN_DOC}`,
  },
];
const PALETTE_RESTRICTIONS = [
  ...CLASS_PATTERNS.flatMap(({ regex, message }) => [
    { selector: `Literal[value=${regex}]`, message },
    { selector: `TemplateElement[value.raw=${regex}]`, message },
  ]),
  {
    selector: "JSXAttribute[name.name='style'] Property[key.name='fontFamily']",
    message: `Use the font-mono / font-sans classes instead of an inline fontFamily. ${TOKEN_DOC}`,
  },
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.pnpm-store/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      jsdoc,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'max-lines': ['error', { max: 350, skipBlankLines: false, skipComments: false }],
      complexity: ['error', 10],
      'no-restricted-syntax': ['error', ...SINK_RESTRICTIONS, ...PALETTE_RESTRICTIONS],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/*',
                '@/hooks/*',
                '@/lib/*',
                '@/types/*',
                './components/*',
                '../components/*',
                '../../components/*',
                './hooks/*',
                '../hooks/*',
                '../../hooks/*',
                './lib/*',
                '../lib/*',
                '../../lib/*',
                './types/*',
                '../types/*',
                '../../types/*',
              ],
              message:
                'Import from the module barrel (@/components, @/hooks, @/lib, @/types) instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/labs/*/frontend/vulnerable.tsx'],
    // Sinks are allowed here; the colour rule still applies.
    rules: { 'no-restricted-syntax': ['error', ...PALETTE_RESTRICTIONS] },
  },
);
