// Undoes what start-services.mjs set up. Imported by Playwright's globalTeardown
// (keep this module free of `import.meta`: Playwright loads it as CommonJS) and
// run from the CLI via cleanup-cli.mjs (`pnpm e2e:cleanup`).
//
// 1. Removes the TMDB mock container.
// 2. Locally (not in CI): `supabase functions serve` replaced the stack's edge
//    runtime with one pointing at the mock; restart the stack so the developer's
//    own runtime (with supabase/functions/.env) comes back. Data is kept.
import { runSync } from '../../tooling/scripts/spawn.mjs';

export function cleanupE2eServices({ restartStack = !process.env.CI } = {}) {
  runSync('docker', ['rm', '-f', 'bingetrail-tmdb-mock'], { stdio: 'ignore' });
  if (!restartStack) return true;

  runSync('pnpm', ['exec', 'supabase', 'stop'], { stdio: 'ignore' });
  // Output is discarded: `supabase start` prints local keys.
  return runSync('pnpm', ['exec', 'supabase', 'start'], { stdio: 'ignore' }).status === 0;
}
