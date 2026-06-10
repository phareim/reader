module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  moduleFileExtensions: ['js', 'ts', 'json', 'vue'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        jsx: 'preserve',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
    '^.+\\.vue$': '@vue/vue3-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
    // motion-v is ESM; we mock it entirely rather than transform it.
    '^motion-v$': '<rootDir>/__tests__/mocks/motion-v.ts',
    // linkedom/worker is ESM-only; under Jest use the CJS main entry.
    '^linkedom/worker$': '<rootDir>/node_modules/linkedom/cjs/index.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'components/**/*.vue',
    'composables/**/*.ts',
    'utils/**/*.ts',
    'server/**/*.ts',
    '!**/node_modules/**',
  ],
  globals: {
    'vue-jest': {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('lazy-'),
      },
    },
  },
};
