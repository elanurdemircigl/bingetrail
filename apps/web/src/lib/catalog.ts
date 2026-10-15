import { z } from 'zod';

import { mediaTypeSchema } from '@bingetrail/shared';

const DIGITS = /^\d{1,9}$/;

/** Plain decimal digits only: rejects "1e3", " 7", "0x1f", "1.5", "-3". */
const digits = (max: number, min = 0) =>
  z.string().regex(DIGITS).transform(Number).pipe(z.number().int().min(min).max(max));

/** Route params are user input: validate before they reach the function. */
export const titleParamsSchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: digits(100_000_000, 1),
});

export const seasonParamsSchema = z.object({
  mediaType: z.literal('tv'),
  tmdbId: digits(100_000_000, 1),
  seasonNumber: digits(500),
});

export const SEARCH_MAX_PAGE = 20;

export function parseSearchParams(raw: { q?: string | string[]; page?: string | string[] }) {
  const query = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '';
  const pageText = typeof raw.page === 'string' ? raw.page : '1';
  const page = DIGITS.test(pageText) ? Math.min(Math.max(Number(pageText), 1), SEARCH_MAX_PAGE) : 1;
  return { query, page };
}

/** TMDB image CDN (allowed in next.config images.remotePatterns). */
export const posterUrl = (path: string, size: 'w185' | 'w342' = 'w342') =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const STATUS_KEYS = {
  Released: 'released',
  Ended: 'ended',
  'Returning Series': 'returning',
  Canceled: 'canceled',
  'In Production': 'inProduction',
  Planned: 'planned',
  'Post Production': 'postProduction',
  Rumored: 'rumored',
  Pilot: 'pilot',
} as const;
export type StatusKey = (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS];

/** Maps TMDB's English status strings to translation keys (unknown → null). */
export function statusKey(status: string | null): StatusKey | null {
  // Own keys only: `status in STATUS_KEYS` would also match "toString" etc.
  return status && Object.hasOwn(STATUS_KEYS, status)
    ? STATUS_KEYS[status as keyof typeof STATUS_KEYS]
    : null;
}

/** TMDB dates are calendar dates; format them in UTC so they never shift a day. */
export const dateFromIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
