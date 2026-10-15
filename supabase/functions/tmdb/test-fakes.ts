// In-memory doubles for handler tests (not deployed: only imported by *.test.ts).
import type { MediaType } from '../_shared/contracts/catalog.ts';

import type { SeasonInput, SeasonWithEpisodes, TitleInput, TitleRecord } from './catalog.ts';
import type { CatalogStore, Deps } from './handler.ts';
import type { RawMovie, RawSeason, RawTv, TmdbApi } from './tmdb-client.ts';

export const NOW = new Date('2026-10-15T12:00:00Z');
export const HOURS = 60 * 60 * 1000;

export class MemoryStore implements CatalogStore {
  titles: TitleRecord[] = [];
  seasons: SeasonWithEpisodes[] = [];
  touched: number[] = [];
  private nextId = 1;
  constructor(private readonly clock: () => Date = () => NOW) {}

  findTitle(mediaType: MediaType, tmdbId: number) {
    return Promise.resolve(
      this.titles.find((t) => t.mediaType === mediaType && t.tmdbId === tmdbId) ?? null,
    );
  }
  saveTitle(input: TitleInput) {
    const existing = this.titles.find(
      (t) => t.mediaType === input.mediaType && t.tmdbId === input.tmdbId,
    );
    const id = existing?.id ?? this.nextId++;
    const record: TitleRecord = {
      ...input,
      id,
      fetchedAt: this.clock().toISOString(),
      seasons: input.seasons.map((s) => ({
        ...s,
        id: this.nextId++,
        fetchedAt: this.clock().toISOString(),
      })),
    };
    this.titles = [...this.titles.filter((t) => t.id !== id), record];
    // Like the real store: saving a show upserts season rows WITHOUT episodes.
    for (const season of record.seasons) {
      const current = this.seasons.find(
        (s) => s.titleId === id && s.seasonNumber === season.seasonNumber,
      );
      this.seasons = [
        ...this.seasons.filter((s) => s !== current),
        { ...season, titleId: id, episodes: current?.episodes ?? [] },
      ];
    }
    return Promise.resolve(record);
  }
  touchTitle(titleId: number) {
    this.touched.push(titleId);
    return Promise.resolve();
  }
  findSeason(titleId: number, seasonNumber: number) {
    return Promise.resolve(
      this.seasons.find((s) => s.titleId === titleId && s.seasonNumber === seasonNumber) ?? null,
    );
  }
  saveSeason(titleId: number, input: SeasonInput) {
    const record: SeasonWithEpisodes = {
      ...input,
      id: this.nextId++,
      titleId,
      fetchedAt: this.clock().toISOString(),
      episodes: input.episodes.map((e) => ({ ...e, id: this.nextId++ })),
    };
    this.seasons = [
      ...this.seasons.filter(
        (s) => !(s.titleId === titleId && s.seasonNumber === input.seasonNumber),
      ),
      record,
    ];
    return Promise.resolve(record);
  }
}

export const rawMovie = (overrides: Partial<RawMovie> = {}): RawMovie => ({
  id: 603,
  title: 'Matrix',
  original_title: 'The Matrix',
  overview: 'Bir bilgisayar korsanı gerçeği öğrenir.',
  poster_path: '/matrix.jpg',
  backdrop_path: null,
  release_date: '1999-03-31',
  status: 'Released',
  ...overrides,
});

export const rawTv = (overrides: Partial<RawTv> = {}): RawTv => ({
  id: 1399,
  name: 'Taht Oyunları',
  original_name: 'Game of Thrones',
  overview: 'Yedi krallık.',
  poster_path: '/got.jpg',
  backdrop_path: '/got-bg.jpg',
  first_air_date: '2011-04-17',
  status: 'Ended',
  number_of_seasons: 1,
  seasons: [{ season_number: 1, name: '1. Sezon', air_date: '2011-04-17', episode_count: 2 }],
  ...overrides,
});

export const rawSeason = (overrides: Partial<RawSeason> = {}): RawSeason => ({
  season_number: 1,
  name: '1. Sezon',
  air_date: '2011-04-17',
  episodes: [
    { episode_number: 1, name: 'Kış Geliyor', air_date: '2011-04-17', runtime: 62 },
    { episode_number: 2, name: 'Kral Yolu', air_date: '2011-04-24', runtime: 56 },
  ],
  ...overrides,
});

export class FakeTmdb implements TmdbApi {
  calls: string[] = [];
  movieResult: () => Promise<RawMovie> = () => Promise.resolve(rawMovie());
  tvResult: () => Promise<RawTv> = () => Promise.resolve(rawTv());
  seasonResult: () => Promise<RawSeason> = () => Promise.resolve(rawSeason());
  searchResult: TmdbApi['searchMulti'] = (_q, page) =>
    Promise.resolve({
      page,
      totalPages: 1,
      totalResults: 2,
      results: [
        {
          media_type: 'movie',
          id: 603,
          title: 'Matrix',
          original_title: 'The Matrix',
          overview: 'x',
          poster_path: '/m.jpg',
          release_date: '1999-03-31',
          first_air_date: null,
        },
        {
          media_type: 'tv',
          id: 1399,
          name: 'Taht Oyunları',
          original_name: 'Game of Thrones',
          overview: '',
          poster_path: null,
          release_date: null,
          first_air_date: '',
        },
      ],
    });

  searchMulti(query: string, page: number, locale: 'tr' | 'en') {
    this.calls.push(`search:${query}:${page}:${locale}`);
    return this.searchResult(query, page, locale);
  }
  movie(id: number, locale: 'tr' | 'en') {
    this.calls.push(`movie:${id}:${locale}`);
    return this.movieResult();
  }
  tv(id: number, locale: 'tr' | 'en') {
    this.calls.push(`tv:${id}:${locale}`);
    return this.tvResult();
  }
  season(id: number, n: number, locale: 'tr' | 'en') {
    this.calls.push(`season:${id}:${n}:${locale}`);
    return this.seasonResult();
  }
}

export function makeDeps(overrides: Partial<Deps> = {}) {
  const tmdb = new FakeTmdb();
  const store = new MemoryStore();
  const logs: string[] = [];
  const deps: Deps = {
    authenticate: (header) =>
      Promise.resolve(header === 'Bearer valid-user-token' ? 'user-1' : null),
    allowRequest: () => Promise.resolve(true),
    tmdb,
    store,
    now: () => NOW,
    allowedOrigins: ['https://app.bingetrail.example'],
    logError: (message) => logs.push(message),
    ...overrides,
  };
  return { deps, tmdb, store, logs };
}

export function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/functions/v1/tmdb', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-user-token',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
