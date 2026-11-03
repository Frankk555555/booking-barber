import js from '@eslint/js';
import ts from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next*/**',
      '**/next-env.d.ts',
      '**/migrations/meta/**',
      'playwright-report/**',
      'test-results/**',
      '.local/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly' } } },
);
