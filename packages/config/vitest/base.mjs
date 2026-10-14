import { defineConfig } from 'vitest/config';

/** Base Vitest config shared by packages; apps merge their own environment. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    environment: 'node',
    restoreMocks: true,
  },
});
