module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Prettier formatting (disabled due to CRLF issues on Windows)
    'prettier/prettier': 'off',

    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    // Disable rules that require type information
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-require-imports': 'off',

    // General code quality rules
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-alert': 'warn',

    // Best practices
    eqeqeq: ['error', 'always'],
    curly: 'off', // Disabled due to many legacy JS files
    'no-eval': 'error',
    'no-implicit-globals': 'off',
    'no-case-declarations': 'off', // Allow case block declarations
  },
  overrides: [
    // Test files configuration
    {
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      env: {
        jest: true,
        node: true,
      },
      extends: ['plugin:jest/recommended', 'plugin:@typescript-eslint/recommended'],
      rules: {
        // Relax some rules for tests
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-console': 'off',
        'jest/expect-expect': 'warn',
        'jest/no-disabled-tests': 'warn',
        'jest/no-conditional-expect': 'off',
        'prettier/prettier': 'off',
      },
    },
    // Integration tests
    {
      files: ['**/integration/**/*.ts'],
      rules: {
        'jest/expect-expect': 'off',
        'prettier/prettier': 'off',
      },
    },
    // Ignore patterns for generated files
    {
      files: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
    '*.json',
    'Data/',
    'bootstrap/',
    'types/',
    'utils/storage/*.js',
    'utils/*.js',
    'services/*.js',
    'helpers/*.js',
    'middleware/*.js',
    'controllers/*.js',
    'tests/*.js',
  ],
};
