import { assert, assertEquals, assertMatch, assertRejects } from '@std/assert';

import { accountErrorSchema, deleteAccountResponseSchema } from '../_shared/contracts/account.ts';

import { removeUserFolder, type BucketApi } from './avatars.ts';
import { createHandler, type Deps, hashUserId } from './handler.ts';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const SALT = 's'.repeat(40);
const PASSWORD = 'binge-trail-2026';

function makeDeps(overrides: Partial<Deps> = {}) {
  const events: string[] = [];
  const logs: string[] = [];
  const deps: Deps = {
    authenticate: (authorization) =>
      Promise.resolve(
        authorization === 'Bearer alice' ? { id: ALICE, email: 'a@example.test' } : null,
      ),
    allowRequest: () => Promise.resolve(true),
    verifyPassword: (_email, password) => Promise.resolve(password === PASSWORD),
    removeAvatars: (id) => {
      events.push(`avatars:${id}`);
      return Promise.resolve();
    },
    deleteUser: (id) => {
      events.push(`user:${id}`);
      return Promise.resolve();
    },
    logDeletion: (hash) => {
      events.push(`log:${hash}`);
      return Promise.resolve();
    },
    hashSalt: SALT,
    allowedOrigins: [],
    logError: (message) => logs.push(message),
    ...overrides,
  };
  return { deps, events, logs };
}

const post = (body: unknown, authorization = 'Bearer alice') =>
  new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function expectError(res: Response, status: number, code: string) {
  assertEquals(res.status, status);
  const body = await res.json();
  assert(accountErrorSchema.safeParse(body).success);
  assertEquals(body.error, code);
}

Deno.test('deletes storage, then the user, then writes the hashed audit row', async () => {
  const { deps, events } = makeDeps();
  const res = await createHandler(deps)(post({ password: PASSWORD }));
  assertEquals(res.status, 200);
  assert(deleteAccountResponseSchema.safeParse(await res.json()).success);
  assertEquals(events.slice(0, 2), [`avatars:${ALICE}`, `user:${ALICE}`]);
  assertEquals(events[2], `log:${await hashUserId(SALT, ALICE)}`);
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
});

Deno.test('the target is the JWT subject, never an id from the body (IDOR)', async () => {
  const { deps, events } = makeDeps();
  const res = await createHandler(deps)(
    post({ password: PASSWORD, userId: BOB, user_id: BOB, id: BOB }),
  );
  assertEquals(res.status, 200);
  assert(events.every((e) => !e.includes(BOB)));
  assert(events.includes(`user:${ALICE}`));
});

Deno.test('rejects missing or invalid tokens without side effects', async () => {
  const { deps, events } = makeDeps();
  const handle = createHandler(deps);
  for (const auth of ['', 'Bearer forged']) {
    await expectError(await handle(post({ password: PASSWORD }, auth)), 401, 'unauthorized');
  }
  const throwing = makeDeps({ authenticate: () => Promise.reject(new Error('down')) });
  await expectError(
    await createHandler(throwing.deps)(post({ password: PASSWORD })),
    401,
    'unauthorized',
  );
  assertEquals(events, []);
});

Deno.test('a wrong password deletes nothing', async () => {
  const { deps, events } = makeDeps();
  await expectError(await createHandler(deps)(post({ password: 'wrong' })), 403, 'reauth_failed');
  assertEquals(events, []);
});

Deno.test('an account without an email cannot be re-authenticated', async () => {
  const { deps, events } = makeDeps({
    authenticate: () => Promise.resolve({ id: ALICE, email: null }),
  });
  await expectError(await createHandler(deps)(post({ password: PASSWORD })), 403, 'reauth_failed');
  assertEquals(events, []);
});

Deno.test('invalid bodies and methods are rejected', async () => {
  const { deps, events } = makeDeps();
  const handle = createHandler(deps);
  for (const body of ['not json', {}, { password: '' }, { password: 'x'.repeat(1025) }]) {
    await expectError(await handle(post(body)), 400, 'invalid_request');
  }
  const get = await handle(new Request('http://localhost/delete-account', { method: 'GET' }));
  assertEquals(get.status, 400);
  assertEquals(get.headers.get('Allow'), 'POST, OPTIONS');
  assertEquals(events, []);
});

Deno.test('rate limited attempts never check the password', async () => {
  let checked = false;
  const { deps, events } = makeDeps({
    allowRequest: () => Promise.resolve(false),
    verifyPassword: () => {
      checked = true;
      return Promise.resolve(true);
    },
  });
  const res = await createHandler(deps)(post({ password: PASSWORD }));
  await expectError(res, 429, 'rate_limited');
  assertEquals(res.headers.get('Retry-After'), '3600');
  assertEquals(checked, false);
  assertEquals(events, []);
});

Deno.test('fails closed when the audit salt is missing or short', async () => {
  for (const hashSalt of [undefined, '', 'short']) {
    const { deps, events, logs } = makeDeps({ hashSalt });
    await expectError(await createHandler(deps)(post({ password: PASSWORD })), 500, 'internal');
    assertEquals(events, []);
    assertMatch(logs[0] ?? '', /ACCOUNT_DELETION_HASH_SALT/);
  }
});

Deno.test('a storage failure aborts before the user is deleted', async () => {
  const { deps, events } = makeDeps({ removeAvatars: () => Promise.reject(new Error('503')) });
  await expectError(await createHandler(deps)(post({ password: PASSWORD })), 500, 'internal');
  assertEquals(events, []);
});

Deno.test('an auth deletion failure reports internal and writes no audit row', async () => {
  const { deps, events } = makeDeps({ deleteUser: () => Promise.reject(new Error('db')) });
  await expectError(await createHandler(deps)(post({ password: PASSWORD })), 500, 'internal');
  assertEquals(events, [`avatars:${ALICE}`]);
});

Deno.test('an audit failure after deletion still reports success', async () => {
  const { deps, logs } = makeDeps({ logDeletion: () => Promise.reject(new Error('db')) });
  const res = await createHandler(deps)(post({ password: PASSWORD }));
  assertEquals(res.status, 200);
  assertMatch(logs[0] ?? '', /audit log failed/);
});

Deno.test('logs never contain the password, token or user id', async () => {
  const secretPassword = 'Pa55-super-secret-value';
  const scenarios: Partial<Deps>[] = [
    { verifyPassword: () => Promise.reject(new Error(secretPassword)) },
    {
      verifyPassword: () => Promise.resolve(true),
      removeAvatars: () => Promise.reject(new Error(ALICE)),
    },
    {
      verifyPassword: () => Promise.resolve(true),
      logDeletion: () => Promise.reject(new Error(ALICE)),
    },
  ];
  for (const overrides of scenarios) {
    const { deps, logs } = makeDeps(overrides);
    await createHandler(deps)(post({ password: secretPassword }));
    assert(logs.length > 0);
    for (const line of logs) {
      for (const secret of [secretPassword, ALICE, 'alice']) assert(!line.includes(secret), line);
    }
  }
});

Deno.test('the audit hash is salted, stable and hex', async () => {
  const a = await hashUserId(SALT, ALICE);
  assertMatch(a, /^[0-9a-f]{64}$/);
  assertEquals(a, await hashUserId(SALT, ALICE));
  assert(a !== (await hashUserId('t'.repeat(40), ALICE)));
  assert(a !== (await hashUserId(SALT, BOB)));
});

Deno.test('CORS: only allowlisted origins are echoed', async () => {
  const { deps } = makeDeps({ allowedOrigins: ['https://app.example.test'] });
  const handle = createHandler(deps);
  const preflight = (origin: string) =>
    handle(new Request('http://localhost/', { method: 'OPTIONS', headers: { Origin: origin } }));
  assertEquals(
    (await preflight('https://app.example.test')).headers.get('Access-Control-Allow-Origin'),
    'https://app.example.test',
  );
  assertEquals(
    (await preflight('https://evil.example.test')).headers.get('Access-Control-Allow-Origin'),
    null,
  );
});

class FakeBucket implements BucketApi {
  removed: string[][] = [];
  constructor(
    private readonly tree: Record<string, Array<{ name: string; id: string | null }>>,
    private readonly failRemove = false,
  ) {}
  list(prefix: string, options: { limit: number; offset: number }) {
    const entries = this.tree[prefix] ?? [];
    return Promise.resolve({
      data: entries.slice(options.offset, options.offset + options.limit),
      error: null,
    });
  }
  remove(paths: string[]) {
    this.removed.push(paths);
    return Promise.resolve({ data: null, error: this.failRemove ? new Error('x') : null });
  }
}

Deno.test('avatar cleanup removes nested and paginated objects', async () => {
  const many = Array.from({ length: 150 }, (_, i) => ({ name: `f${i}.png`, id: `id${i}` }));
  const bucket = new FakeBucket({
    [ALICE]: [...many, { name: 'old', id: null }],
    [`${ALICE}/old`]: [{ name: 'a.webp', id: 'x' }],
  });
  assertEquals(await removeUserFolder(bucket, ALICE), 151);
  const all = bucket.removed.flat();
  assertEquals(all.length, 151);
  assert(all.includes(`${ALICE}/old/a.webp`));
  assert(all.every((p) => p.startsWith(`${ALICE}/`)));
  assert(bucket.removed.every((batch) => batch.length <= 100));
});

Deno.test('avatar cleanup on an empty folder is a no-op', async () => {
  const bucket = new FakeBucket({});
  assertEquals(await removeUserFolder(bucket, ALICE), 0);
  assertEquals(bucket.removed, []);
});

Deno.test('avatar cleanup throws on list or remove errors', async () => {
  await assertRejects(() =>
    removeUserFolder(new FakeBucket({ [ALICE]: [{ name: 'a.png', id: '1' }] }, true), ALICE),
  );
  const broken: BucketApi = {
    list: () => Promise.resolve({ data: null, error: new Error('x') }),
    remove: () => Promise.resolve({ data: null, error: null }),
  };
  await assertRejects(() => removeUserFolder(broken, ALICE));
});
