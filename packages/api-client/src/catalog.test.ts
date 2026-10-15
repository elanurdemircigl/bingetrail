import { describe, expect, it, vi } from 'vitest';

import { CatalogError, getSeasonDetail, getTitleDetail, queryKeys, searchCatalog } from './index';
import type { TypedSupabaseClient } from './index';

function clientReturning(result: { data?: unknown; error?: unknown }) {
  const invoke = vi.fn().mockResolvedValue({ data: null, error: null, ...result });
  return { client: { functions: { invoke } } as unknown as TypedSupabaseClient, invoke };
}

const httpError = (body: unknown) => ({
  name: 'FunctionsHttpError',
  context: { json: () => Promise.resolve(body) },
});

const title = {
  id: 1,
  tmdbId: 603,
  mediaType: 'movie',
  title: 'Kırmızı Hap',
  originalTitle: 'The Red Pill',
  overview: null,
  posterPath: null,
  backdropPath: null,
  releaseDate: '1999-03-31',
  status: 'Released',
  numberOfSeasons: null,
  seasons: [],
};

describe('catalog data access', () => {
  it('invokes the tmdb function with the request contract', async () => {
    const { client, invoke } = clientReturning({
      data: { results: [], page: 1, totalPages: 0, totalResults: 0 },
    });
    await searchCatalog(client, { query: 'kale', locale: 'tr' });
    expect(invoke).toHaveBeenCalledWith('tmdb', {
      body: { action: 'search', page: 1, query: 'kale', locale: 'tr' },
    });
  });

  it('returns validated title and season DTOs', async () => {
    const { client } = clientReturning({ data: title });
    await expect(
      getTitleDetail(client, { mediaType: 'movie', tmdbId: 603, locale: 'tr' }),
    ).resolves.toEqual(title);

    const season = {
      titleId: 2,
      tmdbId: 1399,
      seasonNumber: 1,
      name: '1. Sezon',
      airDate: null,
      episodes: [],
    };
    const second = clientReturning({ data: season });
    await expect(
      getSeasonDetail(second.client, { tmdbId: 1399, seasonNumber: 1, locale: 'tr' }),
    ).resolves.toEqual(season);
  });

  it('maps function error bodies to CatalogError codes', async () => {
    const { client } = clientReturning({ error: httpError({ error: 'not_found' }) });
    await expect(
      getTitleDetail(client, { mediaType: 'movie', tmdbId: 1, locale: 'tr' }),
    ).rejects.toMatchObject({ name: 'CatalogError', code: 'not_found' });
  });

  it('never surfaces unknown error bodies', async () => {
    const { client } = clientReturning({ error: httpError({ message: 'stack trace…' }) });
    await expect(searchCatalog(client, { query: 'x', locale: 'tr' })).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('treats relay/network failures as upstream_unavailable', async () => {
    const { client } = clientReturning({
      error: { name: 'FunctionsFetchError', context: new Error('x') },
    });
    await expect(searchCatalog(client, { query: 'x', locale: 'tr' })).rejects.toBeInstanceOf(
      CatalogError,
    );
    await expect(searchCatalog(client, { query: 'x', locale: 'tr' })).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  it('rejects responses that drift from the contract', async () => {
    const { client } = clientReturning({ data: { ...title, tmdbId: 'six-oh-three' } });
    await expect(
      getTitleDetail(client, { mediaType: 'movie', tmdbId: 603, locale: 'tr' }),
    ).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('catalog query keys', () => {
  it('normalizes search text and separates locales', () => {
    expect(queryKeys.catalog.search('tr', '  Kale ')).toEqual(
      queryKeys.catalog.search('tr', 'kale'),
    );
    expect(queryKeys.catalog.title('tv', 1399, 'tr')).not.toEqual(
      queryKeys.catalog.title('tv', 1399, 'en'),
    );
    expect(queryKeys.catalog.season(1399, 1, 'tr').slice(0, 2)).toEqual([...queryKeys.catalog.all]);
  });
});
