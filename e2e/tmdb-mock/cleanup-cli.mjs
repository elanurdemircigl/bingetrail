#!/usr/bin/env node
// `pnpm e2e:cleanup` — for E2E runs that aborted before Playwright's teardown.
import { cleanupE2eServices } from './cleanup.mjs';

if (!cleanupE2eServices()) {
  console.error('Could not restart local Supabase; run `pnpm db:start`.');
  process.exit(1);
}
console.log('E2E services cleaned up.');
