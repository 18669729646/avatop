import nextTs from 'eslint-config-next/typescript';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]);

export default eslintConfig;
