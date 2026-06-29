/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'import', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.base.json'],
      },
      node: true,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    // The codebase predates strict type-import enforcement and uses value-style
    // imports for types throughout; keep it lint-clean without churning every
    // module (a follow-up `eslint --fix` can re-introduce it project-wide).
    '@typescript-eslint/consistent-type-imports': 'off',
    // Group imports (builtin/external/internal/relative) but do not enforce
    // intra-group alphabetisation or blank-line placement — the established
    // codebase does not follow those sub-rules.
    'import/order': [
      'error',
      {
        groups: [['builtin', 'external', 'internal', 'parent', 'sibling', 'index']],
        'newlines-between': 'ignore',
      },
    ],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'out',
    'coverage',
    '*.config.js',
    '*.config.cjs',
    '*.config.ts',
  ],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // React Three Fiber renders Three.js objects as JSX intrinsic elements
      // (<mesh>, <ambientLight>, <boxGeometry args={…} position={…} …>). The
      // react plugin's DOM-oriented no-unknown-property rule flags these valid
      // R3F props, so disable it for the rendering adapter layer only.
      files: ['apps/desktop/src/renderer/src/rendering/**/*.tsx'],
      rules: {
        'react/no-unknown-property': 'off',
      },
    },
  ],
};
