// Direct access to the LOCAL Supabase stack for assertions the UI cannot show:
// the signed-in user's session (from the browser's cookies), Storage uploads
// and read-only SQL checks. Nothing here is printed; it never runs against a
// remote project (the URL comes from the local-only test wrapper).
import { execFileSync } from 'node:child_process';

import type { Page } from '@playwright/test';

const DB_CONTAINER = 'supabase_db_bingetrail';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const supabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Run E2E through `pnpm test:e2e` (local Supabase env missing).');
  return url;
};
export const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Reads the (possibly chunked) `sb-*-auth-token` cookie of the browser context. */
export async function sessionOf(page: Page): Promise<{ accessToken: string; userId: string }> {
  const cookies = (await page.context().cookies()).filter((c) =>
    /^sb-.+-auth-token(\.\d+)?$/.test(c.name),
  );
  const chunkIndex = (name: string) => Number(/\.(\d+)$/.exec(name)?.[1] ?? -1);
  const raw = cookies
    .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name))
    .map((c) => c.value)
    .join('');
  if (!raw) throw new Error('No Supabase session cookie in this browser context.');
  const json = raw.startsWith('base64-')
    ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8')
    : decodeURIComponent(raw);
  const session = JSON.parse(json) as { access_token: string; user: { id: string } };
  return { accessToken: session.access_token, userId: session.user.id };
}

/** Uploads a tiny PNG to avatars/<userId>/<name> with the user's own token (RLS applies). */
export async function uploadAvatar(accessToken: string, userId: string, name = 'avatar.png') {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/avatars/${userId}/${name}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey(),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
    },
    body: png,
  });
  if (!res.ok) throw new Error(`Avatar upload failed with HTTP ${res.status}`);
}

/** Calls an Edge Function directly (bypassing the web app). */
export function callFunction(name: string, body: unknown, accessToken?: string) {
  return fetch(`${supabaseUrl()}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey(),
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Single-value SQL query in the local database container (test-controlled input only). */
export function sqlValue(query: string): string {
  return execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', query],
    { encoding: 'utf8' },
  ).trim();
}

/** Guards ids interpolated into SQL. */
export function uuid(value: string): string {
  if (!UUID.test(value)) throw new Error('not a uuid');
  return value;
}
