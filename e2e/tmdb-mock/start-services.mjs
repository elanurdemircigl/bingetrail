#!/usr/bin/env node
// Starts the E2E backend pieces next to the local Supabase stack:
//   1. the TMDB mock container on the Supabase Docker network
//   2. `supabase functions serve` with a throwaway env file (fake token, mock URL,
//      random per-run account-deletion salt)
// then serves http://127.0.0.1:3201/ready once both functions answer.
// Used as a Playwright webServer; nothing secret is involved or printed.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, runSync } from '../../tooling/scripts/spawn.mjs';

const MOCK_DIR = dirname(fileURLToPath(import.meta.url));
const CONTAINER = 'bingetrail-tmdb-mock';
const NETWORK = 'supabase_network_bingetrail';
const READY_PORT = 3201;

function localSupabase() {
  const status = runSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (status.status !== 0) throw new Error('Local Supabase is not running (pnpm db:start).');
  const env = Object.fromEntries(
    String(status.stdout)
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim()))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  return { apiUrl: env.API_URL, anonKey: env.ANON_KEY };
}

const { apiUrl, anonKey } = localSupabase();

// 1. TMDB mock
runSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
const started = runSync(
  'docker',
  [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '--network',
    NETWORK,
    '-v',
    `${MOCK_DIR}:/app:ro`,
    'node:24-alpine',
    'node',
    '/app/server.mjs',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
if (started.status !== 0) throw new Error('Could not start the TMDB mock container.');

// 2. Functions with a throwaway env file
const envDir = mkdtempSync(join(tmpdir(), 'bingetrail-e2e-'));
const envFile = join(envDir, 'functions.env');
writeFileSync(
  envFile,
  [
    'TMDB_API_READ_ACCESS_TOKEN=e2e-fake-tmdb-token',
    `TMDB_API_BASE_URL=http://${CONTAINER}:3200/3`,
    `ACCOUNT_DELETION_HASH_SALT=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'),
);
const serve = run('pnpm', ['exec', 'supabase', 'functions', 'serve', '--env-file', envFile], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  serve.kill();
  runSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
  rmSync(envDir, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    cleanup();
    process.exit(0);
  });
}
process.on('exit', cleanup);
serve.on('exit', (code) => {
  if (!cleaned) {
    console.error(`supabase functions serve exited (${code})`);
    cleanup();
    process.exit(1);
  }
});

// 3. Wait until OUR functions answer (401 + {"error":"unauthorized"} for the anon key).
async function functionReady(name) {
  try {
    const res = await fetch(`${apiUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json().catch(() => null);
    return res.status === 401 && body?.error === 'unauthorized';
  } catch {
    return false;
  }
}

const deadline = Date.now() + 180_000;
while (!(await functionReady('tmdb')) || !(await functionReady('delete-account'))) {
  if (Date.now() > deadline) {
    console.error('functions did not become ready in time');
    cleanup();
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

createServer((_req, res) => res.writeHead(200).end('ready')).listen(READY_PORT, '127.0.0.1', () =>
  console.log(`e2e services ready (tmdb mock + functions) on :${READY_PORT}`),
);
