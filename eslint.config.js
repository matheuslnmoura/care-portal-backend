import stylistic from '@stylistic/eslint-plugin';

import tsPlugin from '@typescript-eslint/eslint-plugin';

import tsParser from '@typescript-eslint/parser';

export default [
  // Apply to all JavaScript and TypeScript files
  {
    files: [ '**/*.js', '**/*.ts' ],
    // vitest.config.ts/vitest.setup.ts live outside tsconfig.json's rootDir ("./api") and can never join
    // its program (TS6059), so they're excluded from type-aware linting here rather than fighting rootDir.
    ignores: [ 'node_modules', 'dist', 'scripts/**/*.js', 'scripts/**/*.ts', 'vitest.config.ts', 'vitest.setup.ts' ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json' // Ensure this points to your tsconfig.json
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@stylistic': stylistic
    },
    'rules': {
      // General Best Practices
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [ 'error', { 'argsIgnorePattern': '^_' } ],
      'no-shadow': 'off',
      'no-trailing-spaces': 'error',

      // TypeScript-Specific Rules
      '@typescript-eslint/explicit-function-return-type': [ 'error', { allowExpressions: false } ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': [ 'error', { 'fixToUnknown': false, 'ignoreRestArgs': false } ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-definitions': [ 'error', 'interface' ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [ 'error', { ignoreConditionalTests: true, ignoreTernaryTests: true } ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': [ 'error', { allowBoolean: false, allowNumber: true, allowAny: false } ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // Stylistic Rules (via @stylistic)
      '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
      '@stylistic/arrow-spacing': 'error',
      '@stylistic/block-spacing': 'error',
      '@stylistic/comma-spacing': [ 'error', { 'before': false, 'after': true } ],
      '@stylistic/comma-dangle': [ 'error', 'never' ],
      '@stylistic/indent': [ 'error', 2, { 'SwitchCase': 1 } ],
      '@stylistic/object-curly-spacing': [ 'error', 'always' ],
      '@stylistic/semi': [ 'error', 'always' ],
      '@stylistic/space-before-function-paren': [ 'error', {
        'anonymous': 'never',
        'named': 'never',
        'asyncArrow': 'always'
      } ],
      '@stylistic/quotes': [ 'error', 'single', { 'avoidEscape': true } ],
      '@stylistic/linebreak-style': [ 'error', 'unix' ],
      '@stylistic/space-before-blocks': [ 'error', 'always' ],
      '@stylistic/keyword-spacing': [ 'error' ],

      // Node.js Best Practices
      'callback-return': 'off',
      'global-require': 'off',
      'no-process-env': 'off',
      'handle-callback-err': 'error',
      'no-multiple-empty-lines': [ 'error', { 'max': 1 } ]
    }
  }
];
