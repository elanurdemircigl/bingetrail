#!/usr/bin/env node
// Like with-local-supabase-env.mjs, but for the Expo app on a phone or emulator:
// sets EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the
// running local Supabase stack. A phone cannot reach 127.0.0.1 on this computer,
// so the URL uses this machine's LAN IPv4 address (override with
// BINGETRAIL_SUPABASE_HOST, e.g. 10.0.2.2 for the Android emulator).
// Only public values; nothing is printed except the host, nothing is written to disk.
//
// Usage: node tooling/scripts/with-local-supabase-env-mobile.mjs <command> [args...]
import { networkInterfaces } from 'node:os';

import { run, runSync } from './spawn.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: with-local-supabase-env-mobile <command> [args...]');
  process.exit(2);
}

const status = runSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
if (status.status !== 0) {
  console.error('Local Supabase is not running. Start it with `pnpm db:start` (Docker required).');
  process.exit(1);
}

/** @type {Record<string, string>} */
const local = {};
for (const line of String(status.stdout).split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (match?.[1] && match[2] !== undefined) local[match[1]] = match[2];
}

const publishableKey = local.PUBLISHABLE_KEY;
const apiUrl = local.API_URL ? new URL(local.API_URL) : null;
if (!apiUrl || !publishableKey?.startsWith('sb_publishable_')) {
  console.error('Could not read a publishable key and API URL from `supabase status`.');
  process.exit(1);
}

/** First private IPv4 address of this machine (Wi-Fi / Ethernet). */
function lanAddress() {
  const candidates = Object.values(networkInterfaces()).flatMap((list) =>
    (list ?? []).filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address),
  );
  return (
    candidates.find((a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) ?? candidates[0]
  );
}

const host = process.env.BINGETRAIL_SUPABASE_HOST || lanAddress();
if (!host) {
  console.error('No network address found; set BINGETRAIL_SUPABASE_HOST.');
  process.exit(1);
}
apiUrl.hostname = host;
console.log(`Mobile app will use local Supabase at ${apiUrl.origin}`);

const child = run(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: apiUrl.origin,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  },
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
