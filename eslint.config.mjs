// Configuración de ESLint 9 (flat config) para todo el monorepo.
// Se ejecuta desde la raíz: `pnpm lint`. El CI la usa y falla si hay errores.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**', '**/.next/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      // Justificación (mandato 4 de CLAUDE.md): en tests, los mocks de fetch y
      // Supabase acceden a propiedades de vi.fn() que no tienen tipos. Esta
      // excepción NO aplica al código de producción (src fuera de __tests__).
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
