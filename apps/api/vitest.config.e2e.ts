import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      DATABASE_URL: 'postgresql://valueflow:valueflow@localhost:5432/valueflow?schema=public',
      JWT_ACCESS_SECRET: 'development-access-secret-change-before-production',
      JWT_REFRESH_SECRET: 'development-refresh-secret-change-before-production',
    },
  },
});
