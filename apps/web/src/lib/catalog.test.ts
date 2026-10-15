import { describe, expect, it } from 'vitest';

import {
  dateFromIso,
  parseSearchParams,
  posterUrl,
  seasonParamsSchema,
  statusKey,
  titleParamsSchema,
} from './catalog';

describe('route param validation', () => {
  it('accepts valid title params', () => {
    expect(titleParamsSchema.parse({ mediaType: 'tv', tmdbId: '1399' })).toEqual({
      mediaType: 'tv',
      tmdbId: 1399,
    });
  });

  it.each([
    { mediaType: 'person', tmdbId: '1' },
    { mediaType: 'movie', tmdbId: 'abc' },
    { mediaType: 'movie', tmdbId: '-3' },
    { mediaType: 'movie', tmdbId: '0' },
    { mediaType: 'movie', tmdbId: '1.5' },
    { mediaType: 'movie', tmdbId: '1e3' },
    { mediaType: 'movie', tmdbId: ' 7' },
  ])('rejects %j', (params) => {
    expect(titleParamsSchema.safeParse(params).success).toBe(false);
  });

  it('seasons exist only for series', () => {
    expect(
      seasonParamsSchema.safeParse({ mediaType: 'tv', tmdbId: '1', seasonNumber: '0' }).success,
    ).toBe(true);
    expect(
      seasonParamsSchema.safeParse({ mediaType: 'movie', tmdbId: '1', seasonNumber: '1' }).success,
    ).toBe(false);
  });
});

describe('parseSearchParams', () => {
  it('trims and caps the query, clamps the page', () => {
    expect(parseSearchParams({ q: '  kale ', page: '3' })).toEqual({ query: 'kale', page: 3 });
    expect(parseSearchParams({ q: 'x'.repeat(150) }).query).toHaveLength(100);
    expect(parseSearchParams({ q: 'a', page: '999' }).page).toBe(20);
  });

  it.each(['0x10', '1e3', '-1', 'abc', ''])('ignores a malformed page %j', (page) => {
    expect(parseSearchParams({ q: 'a', page }).page).toBe(1);
  });

  it('ignores repeated parameters', () => {
    expect(parseSearchParams({ q: ['a', 'b'], page: ['2', '3'] })).toEqual({ query: '', page: 1 });
  });
});

describe('presentation helpers', () => {
  it('builds TMDB CDN URLs only from the validated image path', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });

  it('maps known TMDB statuses and ignores unknown ones', () => {
    expect(statusKey('Returning Series')).toBe('returning');
    expect(statusKey('toString')).toBeNull();
    expect(statusKey('Something new')).toBeNull();
    expect(statusKey(null)).toBeNull();
  });

  it('parses calendar dates as UTC midnight', () => {
    expect(dateFromIso('2011-04-17').toISOString()).toBe('2011-04-17T00:00:00.000Z');
  });
});
