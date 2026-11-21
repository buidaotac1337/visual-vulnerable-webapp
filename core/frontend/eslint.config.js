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
      'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]',
    message:
      'Writing innerHTML/outerHTML is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML is only allowed in labs/<id>/frontend/vulnerable.tsx (ADR-0006).',
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
      'no-restricted-syntax': ['error', ...SINK_RESTRICTIONS],
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
    rules: { 'no-restricted-syntax': 'off' },
  },
);
