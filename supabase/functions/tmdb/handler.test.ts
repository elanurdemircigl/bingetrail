import { assert, assertEquals } from '@std/assert';

import {
  catalogErrorSchema,
  searchResponseSchema,
  seasonDetailSchema,
  titleDetailSchema,
} from '../_shared/contracts/catalog.ts';

import { createHandler } from './handler.ts';
import { TmdbError } from './tmdb-client.ts';
import { HOURS, makeDeps, MemoryStore, NOW, post, rawMovie } from './test-fakes.ts';

const titleReq = (locale: 'tr' | 'en' = 'tr') => ({
  action: 'title',
  mediaType: 'movie',
  tmdbId: 603,
  locale,
});

Deno.test('rejects requests without a valid bearer token', async () => {
  const { deps, tmdb } = makeDeps();
  const handle = createHandler(deps);
  for (const headers of [{ Authorization: '' }, { Authorization: 'Bearer forged' }]) {
    const res = await handle(post(titleReq(), headers));
    assertEquals(res.status, 401);
    assertEquals(await res.json(), { error: 'unauthorized' });
  }
  assertEquals(tmdb.calls, []);
});

Deno.test('only POST (and CORS preflight) is accepted', async () => {
  const handle = createHandler(makeDeps().deps);
  const res = await handle(new Request('http://localhost/tmdb', { method: 'GET' }));
  assertEquals(res.status, 400);
  assertEquals(res.headers.get('Allow'), 'POST, OPTIONS');
});

Deno.test('invalid bodies are rejected before any upstream call', async () => {
  const { deps, tmdb } = makeDeps();
  const handle = createHandler(deps);
  const bad = [
    'not json',
    { action: 'delete' },
    { action: 'search', query: '', locale: 'tr' },
    { action: 'search', query: 'x'.repeat(101), locale: 'tr' },
    { action: 'title', mediaType: 'person', tmdbId: 1, locale: 'tr' },
    { action: 'title', mediaType: 'movie', tmdbId: -5, locale: 'tr' },
    { action: 'title', mediaType: 'movie', tmdbId: '603/../../account', locale: 'tr' },
    { action: 'season', tmdbId: 1399, seasonNumber: 1.5, locale: 'tr' },
    { action: 'title', mediaType: 'movie', tmdbId: 603, locale: 'de' },
  ];
  for (const body of bad) {
    const res = await handle(post(body));
    assertEquals(res.status, 400, JSON.stringify(body));
    assertEquals(catalogErrorSchema.parse(await res.json()).error, 'invalid_request');
  }
  assertEquals(tmdb.calls, []);
});

Deno.test('rate-limited users get 429 with Retry-After and no upstream call', async () => {
  const { deps, tmdb } = makeDeps({ allowRequest: () => Promise.resolve(false) });
  const res = await createHandler(deps)(post(titleReq()));
  assertEquals(res.status, 429);
  assertEquals(res.headers.get('Retry-After'), '60');
  assertEquals(tmdb.calls, []);
});

Deno.test('search normalizes results to the contract', async () => {
  const { deps, tmdb } = makeDeps();
  const res = await createHandler(deps)(
    post({ action: 'search', query: '  matrix ', locale: 'en' }),
  );
  assertEquals(res.status, 200);
  const body = searchResponseSchema.parse(await res.json());
  assertEquals(tmdb.calls, ['search:matrix:1:en']);
  assertEquals(
    body.results.map((r) => [r.mediaType, r.tmdbId, r.title]),
    [
      ['movie', 603, 'Matrix'],
      ['tv', 1399, 'Taht Oyunları'],
    ],
  );
  // Empty overview and empty date become null.
  assertEquals(body.results[1]?.overview, null);
  assertEquals(body.results[1]?.releaseDate, null);
});

Deno.test('title: cache miss fetches and stores, fresh cache is served without TMDB', async () => {
  const { deps, tmdb, store } = makeDeps();
  const handle = createHandler(deps);

  const first = titleDetailSchema.parse(await (await handle(post(titleReq()))).json());
  assertEquals(first.title, 'Matrix');
  assertEquals(tmdb.calls, ['movie:603:tr']);

  const second = titleDetailSchema.parse(await (await handle(post(titleReq()))).json());
  assertEquals(second.id, first.id);
  assertEquals(tmdb.calls.length, 1, 'served from cache');
  assertEquals(store.touched, [first.id], 'last_referenced_at refreshed on cache hit');
});

Deno.test('title: a new locale is fetched and merged, keeping the other translation', async () => {
  const { deps, tmdb, store } = makeDeps();
  const handle = createHandler(deps);
  await handle(post(titleReq('tr')));
  tmdb.movieResult = () =>
    Promise.resolve(rawMovie({ title: 'The Matrix', overview: 'A hacker learns the truth.' }));

  const en = titleDetailSchema.parse(await (await handle(post(titleReq('en')))).json());
  assertEquals(en.title, 'The Matrix');
  assertEquals(tmdb.calls, ['movie:603:tr', 'movie:603:en']);
  assertEquals(Object.keys(store.titles[0]!.translations).sort(), ['en', 'tr']);
});

Deno.test('title: stale cache (older than 24h) is refreshed', async () => {
  let clock = NOW;
  const store = new MemoryStore(() => clock);
  const { deps, tmdb } = makeDeps({ store, now: () => clock });
  const handle = createHandler(deps);
  await handle(post(titleReq()));
  clock = new Date(NOW.getTime() + 25 * HOURS);
  await handle(post(titleReq()));
  assertEquals(tmdb.calls, ['movie:603:tr', 'movie:603:tr']);
});

Deno.test('season: loads the show first and returns episodes with database ids', async () => {
  const { deps, tmdb } = makeDeps();
  const handle = createHandler(deps);
  const res = await handle(post({ action: 'season', tmdbId: 1399, seasonNumber: 1, locale: 'tr' }));
  assertEquals(res.status, 200);
  const season = seasonDetailSchema.parse(await res.json());
  assertEquals(tmdb.calls, ['tv:1399:tr', 'season:1399:1:tr']);
  assertEquals(
    season.episodes.map((e) => e.name),
    ['Kış Geliyor', 'Kral Yolu'],
  );
  assert(season.episodes.every((e) => e.id > 0));

  await handle(post({ action: 'season', tmdbId: 1399, seasonNumber: 1, locale: 'tr' }));
  assertEquals(tmdb.calls.length, 2, 'second request served from cache');
});

Deno.test('TMDB 404 maps to not_found, outages to upstream_unavailable', async () => {
  const { deps, tmdb, logs } = makeDeps();
  const handle = createHandler(deps);

  tmdb.movieResult = () => Promise.reject(new TmdbError('not_found', 404));
  const missing = await handle(post(titleReq()));
  assertEquals([missing.status, (await missing.json()).error], [404, 'not_found']);

  tmdb.movieResult = () => Promise.reject(new TmdbError('upstream_unavailable', 503));
  const down = await handle(post(titleReq()));
  assertEquals([down.status, (await down.json()).error], [502, 'upstream_unavailable']);
  assertEquals(logs, ['tmdb upstream error status=503']);
});

Deno.test('unexpected failures return a bare internal error without details', async () => {
  const { deps, tmdb, logs } = makeDeps();
  tmdb.movieResult = () => Promise.reject(new TypeError('secret detail: token=abc'));
  const res = await createHandler(deps)(post(titleReq()));
  assertEquals(res.status, 500);
  const text = await res.text();
  assertEquals(JSON.parse(text), { error: 'internal' });
  assert(!text.includes('secret'));
  assertEquals(logs, ['tmdb function internal error: TypeError'], 'log keeps only the error class');
});

Deno.test('responses are not cacheable and CORS is limited to allowed origins', async () => {
  const handle = createHandler(makeDeps().deps);
  const allowed = await handle(post(titleReq(), { Origin: 'https://app.bingetrail.example' }));
  assertEquals(
    allowed.headers.get('Access-Control-Allow-Origin'),
    'https://app.bingetrail.example',
  );
  assertEquals(allowed.headers.get('Cache-Control'), 'no-store');

  const other = await handle(post(titleReq(), { Origin: 'https://evil.example' }));
  assertEquals(other.headers.get('Access-Control-Allow-Origin'), null);

  const preflight = await handle(
    new Request('http://localhost/tmdb', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    }),
  );
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get('Access-Control-Allow-Origin'), null);
});
