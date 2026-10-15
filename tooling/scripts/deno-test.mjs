#!/usr/bin/env node
// Type-checks and tests Edge Functions with the same Deno version as the local
// edge runtime. Uses a local `deno` if installed, otherwise the pinned Docker image.
//
// Usage: node tooling/scripts/deno-test.mjs
import { runSync } from './spawn.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DENO_VERSION = '2.1.4'; // keep in sync with the Supabase edge runtime and CI
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');
const FUNCTION_DIRS = ['tmdb', 'delete-account'];

const steps = FUNCTION_DIRS.flatMap((fn) => [
  ['check', '--config', `${fn}/deno.json`, `${fn}/index.ts`],
  ['test', '--config', `${fn}/deno.json`, '--no-prompt', `${fn}/`],
]);

const hasLocalDeno = runSync('deno', ['--version'], { stdio: 'ignore' }).status === 0;

for (const args of steps) {
  const result = hasLocalDeno
    ? runSync('deno', args, { cwd: FUNCTIONS, stdio: 'inherit' })
    : runSync(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${FUNCTIONS}:/functions`,
          '-v',
          'bingetrail-deno-cache:/deno-dir',
          '-w',
          '/functions',
          `denoland/deno:${DENO_VERSION}`,
          'deno',
          ...args,
        ],
        { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
      );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
