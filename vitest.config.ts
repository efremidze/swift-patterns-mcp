import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.opencode/**',
      '**/.claude/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/integration/**',
        'src/**/fixtures/**',
        '**/build/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/.opencode/**',
        '**/.claude/**',
        'scripts/**',
      ],
      thresholds: {
        statements: 55,
        branches: 70,
        functions: 75,
        lines: 55,
      },
      reportOnFailure: true,
      reporter: ['text', 'html'],
    },
  },
});
