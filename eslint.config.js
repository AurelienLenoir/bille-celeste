import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const restrict = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'ios', 'android', 'assets'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' }],
    },
  },
  // Architecture rules from CLAUDE.md (later blocks override earlier ones for the same rule)
  {
    files: ['src/**/*.ts'],
    ignores: ['src/platform/**'],
    rules: restrict(['@capacitor/*'], 'Only src/platform/ may import Capacitor.'),
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: restrict(
      ['**/game/**', '**/ui/**', '**/meta/**', '@capacitor/*'],
      'engine/ must not depend on game/, ui/, meta/ or Capacitor.',
    ),
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      ...restrict(['**/ui/**', '@capacitor/*'], 'game/ must not depend on ui/ or Capacitor.'),
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'game/ does not touch the DOM: emit an event instead.' },
      ],
    },
  },
  {
    files: ['*.config.ts', '*.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
