import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Zona horaria fija: los tests dan el mismo resultado en ambos
    // computadores y en CI (que corre en UTC).
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/index.ts', 'src/db/index.ts'],
      // Mínimo exigido por CLAUDE.md (mandato 3). Si la cobertura baja de
      // aquí, `pnpm test:coverage` FALLA (también en CI).
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
