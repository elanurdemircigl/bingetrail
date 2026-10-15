import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

// Runs against the production build and the LOCAL Supabase stack:
//   pnpm db:start && pnpm build:web:local && pnpm test:e2e
// `pnpm test:e2e` injects the local public Supabase settings (see
// tooling/scripts/with-local-supabase-env.mjs); no .env file is involved.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm --filter @bingetrail/web exec next start --port ${PORT}`,
    url: `${baseURL}/tr`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
