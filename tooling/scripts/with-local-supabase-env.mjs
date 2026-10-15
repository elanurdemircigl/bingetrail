#!/usr/bin/env node
// Runs a command with the PUBLIC settings of the running local Supabase stack:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, MAILPIT_URL
// Values are read from `supabase status -o env` and passed only through the
// child's environment. They are never printed and never written to disk, so no
// .env.local file is needed for local E2E or CI.
//
// Usage: node tooling/scripts/with-local-supabase-env.mjs <command> [args...]
import { spawn, spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: with-local-supabase-env <command> [args...]');
  process.exit(2);
}

const status = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'ignore'],
});
if (status.status !== 0) {
  console.error('Local Supabase is not running. Start it with `pnpm db:start` (Docker required).');
  process.exit(1);
}

/** @type {Record<string, string>} */
const local = {};
for (const line of status.stdout.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (match?.[1] && match[2] !== undefined) local[match[1]] = match[2];
}

const url = local.API_URL;
const publishableKey = local.PUBLISHABLE_KEY;
if (!url || !publishableKey) {
  console.error('Could not read API_URL / PUBLISHABLE_KEY from `supabase status`.');
  process.exit(1);
}
// Defence in depth: never hand a secret key to a public variable.
if (!publishableKey.startsWith('sb_publishable_')) {
  console.error('Refusing to continue: PUBLISHABLE_KEY is not a publishable key.');
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    MAILPIT_URL: process.env.MAILPIT_URL ?? local.MAILPIT_URL ?? 'http://127.0.0.1:54324',
  },
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
