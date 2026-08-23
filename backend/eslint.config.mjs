import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Flat config (ESLint 9).
 *
 * Rule choices are aimed at the failure modes this codebase actually has rather than at
 * maximum strictness — a lint run that reports hundreds of stylistic complaints gets
 * switched off, which is worse than no linting. Formatting is Prettier's job and is not
 * duplicated here.
 *
 * The `lint` script pins `--max-warnings` to the current warning count, so it works as a
 * ratchet: any *new* warning fails the build while the existing backlog does not have to be
 * cleared first. Lower that number as the backlog shrinks; `lint:strict` demands zero.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * A dropped promise in a request handler surfaces as a hung request or an
       * unhandled rejection that only appears in production logs, so unawaited
       * thenables are an error. Deliberate fire-and-forget is marked with `void`,
       * which this rule accepts — the codebase already uses that convention.
       */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Express middleware is legitimately passed as an async function.
        { checksVoidReturn: false },
      ],
      '@typescript-eslint/await-thenable': 'error',

      /**
       * `any` is warn, not error. There are ~200 existing occurrences; making it an error
       * would mean either a huge mechanical diff now or `--max-warnings` set so high the
       * lint step stops meaning anything. Warn keeps them visible and countable.
       */
      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        // Leading underscore marks an intentionally unused binding (Express's `_req`).
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // `catch {}` with no binding is used intentionally throughout for optional work.
      'no-empty': ['error', { allowEmptyCatch: true }],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    /**
     * Test suites and operational scripts are console programs: they assert loosely,
     * poke at internals and exit on failure. Type-strictness there costs more than it pays.
     */
    files: ['src/tests/**/*.ts', 'src/scripts/**/*.ts', 'src/prisma/seed.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  }
);
