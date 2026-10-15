import { assert, assertEquals, assertRejects } from '@std/assert';

import { createTmdbApi, TmdbError } from './tmdb-client.ts';
import { rawMovie } from './test-fakes.ts';

type Call = { url: URL; init: RequestInit };

function fakeFetch(responses: Array<() => Response>) {
  const calls: Call[] = [];
  const fetchImpl = (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    return Promise.resolve(next());
  };
  return { calls, fetchImpl };
}

const ok = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => () => new Response('{}', { status: code });

Deno.test('builds TMDB URLs from validated ids and sends the token only as a header', async () => {
  const { calls, fetchImpl } = fakeFetch([ok(rawMovie())]);
  const api = createTmdbApi({
    baseUrl: 'https://api.themoviedb.org/3',
    token: 'tmdb-test-token',
    fetchImpl,
  });
  await api.movie(603, 'tr');

  const [call] = calls;
  assertEquals(call?.url.toString(), 'https://api.themoviedb.org/3/movie/603?language=tr-TR');
  assertEquals(
    (call?.init.headers as Record<string, string>).Authorization,
    'Bearer tmdb-test-token',
  );
  assert(!call?.url.toString().includes('tmdb-test-token'));
});

Deno.test('search encodes the query as a parameter, never as part of the path', async () => {
  const { calls, fetchImpl } = fakeFetch([
    ok({ page: 1, total_pages: 0, total_results: 0, results: [] }),
  ]);
  const api = createTmdbApi({ baseUrl: 'https://api.themoviedb.org/3/', token: 't', fetchImpl });
  await api.searchMulti('../../account?x=1#', 2, 'en');

  const url = calls[0]!.url;
  assertEquals(url.origin + url.pathname, 'https://api.themoviedb.org/3/search/multi');
  assertEquals(url.searchParams.get('query'), '../../account?x=1#');
  assertEquals(url.searchParams.get('include_adult'), 'false');
  assertEquals(url.searchParams.get('language'), 'en-US');
});

Deno.test('search drops people and malformed items instead of failing', async () => {
  const { fetchImpl } = fakeFetch([
    ok({
      page: 1,
      total_pages: 1,
      total_results: 3,
      results: [
        { media_type: 'person', id: 1, name: 'Keanu' },
        { media_type: 'movie', id: 'oops' },
        { media_type: 'movie', id: 603, title: 'Matrix', original_title: 'The Matrix' },
      ],
    }),
  ]);
  const api = createTmdbApi({ baseUrl: 'https://api.themoviedb.org/3', token: 't', fetchImpl });
  const result = await api.searchMulti('matrix', 1, 'tr');
  assertEquals(
    result.results.map((r) => r.id),
    [603],
  );
});

Deno.test('retries once on 429/5xx, then reports upstream_unavailable', async () => {
  const { calls, fetchImpl } = fakeFetch([status(429), ok(rawMovie())]);
  const api = createTmdbApi({
    baseUrl: 'https://x.test/3',
    token: 't',
    fetchImpl,
    retryDelayMs: 1,
  });
  await api.movie(603, 'tr');
  assertEquals(calls.length, 2);

  const failing = fakeFetch([status(503), status(503)]);
  const api2 = createTmdbApi({
    baseUrl: 'https://x.test/3',
    token: 't',
    fetchImpl: failing.fetchImpl,
    retryDelayMs: 1,
  });
  const error = await assertRejects(() => api2.movie(603, 'tr'), TmdbError);
  assertEquals([error.kind, error.status], ['upstream_unavailable', 503]);
});

Deno.test('404 is not retried and maps to not_found', async () => {
  const { calls, fetchImpl } = fakeFetch([status(404)]);
  const api = createTmdbApi({
    baseUrl: 'https://x.test/3',
    token: 't',
    fetchImpl,
    retryDelayMs: 1,
  });
  const error = await assertRejects(() => api.tv(1, 'tr'), TmdbError);
  assertEquals(error.kind, 'not_found');
  assertEquals(calls.length, 1);
});

Deno.test('unexpected payload shapes are treated as an upstream failure', async () => {
  const { fetchImpl } = fakeFetch([ok({ unexpected: true })]);
  const api = createTmdbApi({ baseUrl: 'https://x.test/3', token: 't', fetchImpl });
  const error = await assertRejects(() => api.movie(603, 'tr'), TmdbError);
  assertEquals(error.kind, 'upstream_unavailable');
});

Deno.test('network errors map to upstream_unavailable', async () => {
  const api = createTmdbApi({
    baseUrl: 'https://x.test/3',
    token: 't',
    fetchImpl: () => Promise.reject(new TypeError('connection refused')),
  });
  const error = await assertRejects(() => api.movie(603, 'tr'), TmdbError);
  assertEquals(error.kind, 'upstream_unavailable');
});
