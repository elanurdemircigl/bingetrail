import { cleanupE2eServices } from './tmdb-mock/cleanup.mjs';

/**
 * Runs in Playwright's main process after the tests — unlike signal handlers in
 * the webServer scripts, it also runs on Windows, where child processes are
 * killed without a signal. If a run aborts before tests start (e.g. missing
 * build), use `pnpm e2e:cleanup`.
 */
export default function globalTeardown() {
  if (!cleanupE2eServices()) {
    console.warn('E2E teardown: could not restart local Supabase; run `pnpm db:start`.');
  }
}
