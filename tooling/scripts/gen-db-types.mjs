#!/usr/bin/env node
// Regenerates packages/db-types from the LOCAL database, but only writes the
// file if the output looks like the real schema. A half-reset or empty database
// otherwise produces `Tables: {}` silently, which breaks every consumer.
//
// Usage: node tooling/scripts/gen-db-types.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSync } from './spawn.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TARGET = join(ROOT, 'packages', 'db-types', 'src', 'database.types.ts');
// Tables that must always exist; extend when a phase adds a core table.
const REQUIRED_TABLES = [
  'profiles',
  'titles',
  'seasons',
  'episodes',
  'watchlist_items',
  'episode_progress',
];

const result = runSync(
  'pnpm',
  ['exec', 'supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
const output = String(result.stdout ?? '');

if (result.status !== 0) {
  console.error('db:types: `supabase gen types` failed; is the local database running?');
  process.exit(1);
}
const missing = REQUIRED_TABLES.filter((table) => !output.includes(`"${table}": {`));
if (missing.length > 0) {
  console.error(
    `db:types: generated types are missing ${missing.join(', ')} — refusing to overwrite.`,
  );
  console.error('Run `pnpm db:reset` and try again.');
  process.exit(1);
}

writeFileSync(TARGET, output);
console.log(`db:types: wrote ${REQUIRED_TABLES.length}+ tables to packages/db-types`);
