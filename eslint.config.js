// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // The package intentionally uses `any` in a few system-boundary
      // spots (validators receiving unknown input). Warn rather than
      // error so PRs aren't blocked but the smell is visible.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Test files use `_unused` underscore prefix for omitted
      // destructure rests; allow.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
