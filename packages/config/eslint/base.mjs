import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint rules for every BingeTrail workspace.
 * Apps layer framework presets (Next.js, Expo) on top of this.
 */
export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/.next/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    '**/expo-env.d.ts',
  ],
};

/** @type {import('eslint').Linter.Config} */
export const securityRules = {
  rules: {
    // Untrusted text (notes, TMDB data) must never be injected as raw HTML.
    'no-restricted-syntax': [
      'error',
      {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'dangerouslySetInnerHTML is forbidden; render text safely instead.',
      },
    ],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
};

export default tseslint.config(
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  securityRules,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
