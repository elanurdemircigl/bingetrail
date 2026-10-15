// Minimal TMDB v3 stand-in for E2E. Runs inside Docker on the Supabase network
// so the edge runtime can reach it as http://bingetrail-tmdb-mock:3200/3.
// Requires the fake bearer token so the test proves the function sends it.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const EXPECTED_AUTH = 'Bearer e2e-fake-tmdb-token';

// "Uzun Yol" / "The Long Road" (tv 4242): one ended season with 120 aired
// episodes, generated so bulk marking (100+ in one request) can be tested.
const LONG_ID = '4242';
const LONG_EPISODES = 120;
const longShow = (language) => ({
  id: 4242,
  name: language === 'tr-TR' ? 'Uzun Yol' : 'The Long Road',
  original_name: 'The Long Road',
  overview: language === 'tr-TR' ? 'Çok uzun bir yolculuk.' : 'A very long journey.',
  poster_path: null,
  backdrop_path: null,
  first_air_date: '2015-01-01',
  status: 'Ended',
  number_of_seasons: 1,
  seasons: [
    {
      season_number: 1,
      name: language === 'tr-TR' ? '1. Sezon' : 'Season 1',
      air_date: '2015-01-01',
      episode_count: LONG_EPISODES,
    },
  ],
});
const longSeason = (language) => ({
  season_number: 1,
  name: language === 'tr-TR' ? '1. Sezon' : 'Season 1',
  air_date: '2015-01-01',
  episodes: Array.from({ length: LONG_EPISODES }, (_, i) => ({
    episode_number: i + 1,
    name: language === 'tr-TR' ? `Bölüm ${i + 1}` : `Episode ${i + 1}`,
    air_date: new Date(Date.UTC(2015, 0, 1 + i)).toISOString().slice(0, 10),
    runtime: 24,
  })),
});

const routes = [
  [
    /^\/3\/search\/multi$/,
    (url) =>
      url.searchParams.get('query') === 'yokboylebirsey'
        ? { page: 1, total_pages: 0, total_results: 0, results: [] }
        : (fixtures.search[url.searchParams.get('language')] ?? fixtures.search['tr-TR']),
  ],
  [/^\/3\/movie\/(\d+)$/, (url, [, id]) => fixtures.movie[id]?.[url.searchParams.get('language')]],
  [
    /^\/3\/tv\/(\d+)$/,
    (url, [, id]) =>
      id === LONG_ID
        ? longShow(url.searchParams.get('language'))
        : fixtures.tv[id]?.[url.searchParams.get('language')],
  ],
  [
    /^\/3\/tv\/(\d+)\/season\/(\d+)$/,
    (url, [, id, n]) =>
      id === LONG_ID && n === '1'
        ? longSeason(url.searchParams.get('language'))
        : fixtures.season[`${id}/${n}`]?.[url.searchParams.get('language')],
  ],
];

createServer((req, res) => {
  const url = new URL(req.url, 'http://mock');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/health') return send(200, { ok: true });
  if (req.headers.authorization !== EXPECTED_AUTH)
    return send(401, { status_message: 'Invalid API key' });

  for (const [pattern, handler] of routes) {
    const match = pattern.exec(url.pathname);
    if (match) {
      const body = handler(url, match);
      return body ? send(200, body) : send(404, { status_message: 'Not found' });
    }
  }
  send(404, { status_message: 'Not found' });
}).listen(3200, '0.0.0.0');
