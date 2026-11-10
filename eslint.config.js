// ESLint flat config cho monorepo Sidekick AI.
// Dùng ESLint 10 + typescript-eslint 8.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/drizzle/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2023,
      },
    },
    rules: {
      // Ban `any` — dung `unknown` + type guard (rule coding-standards.mdc)
      '@typescript-eslint/no-explicit-any': 'error',
      // Khong dung non-null assertion `!` tru khi da kiem tra null
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-module-boundary-types': 'off',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
  {
    // File test: cho phep console.log va magic numbers
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/e2e/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Server: log ra console la chu dich (khong phai debug trai).
    files: ['apps/server/src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // CLI: log ra console la chu dich (CLI dung console de in ket qua).
    files: ['apps/eval/src/cli.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Script node ESM (.mjs): cho phep console.log + globals cua Node 22.
    //
    // `chrome` cung duoc them: code trong `page.evaluate()` chay **trong
    // trang extension** → co API `chrome.storage` thật (khong phai global
    // cua Node) → ESLint phai biet de khong bao `no-undef`.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        chrome: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
)
