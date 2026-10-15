import { z } from 'zod';

import type { CatalogLocale } from '../_shared/contracts/catalog.ts';

/** Thrown for any TMDB failure; `kind` decides the HTTP status we return. */
export class TmdbError extends Error {
  constructor(
    readonly kind: 'not_found' | 'upstream_unavailable',
    readonly status?: number,
  ) {
    super(`TMDB ${kind}${status ? ` (${status})` : ''}`);
  }
}

const TMDB_LANGUAGE: Record<CatalogLocale, string> = { tr: 'tr-TR', en: 'en-US' };

// Raw TMDB payloads: only the fields we use; unknown keys are stripped.
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

const searchItem = z.object({
  media_type: z.string(),
  id: z.number().int().positive(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  overview: nullableString,
  poster_path: nullableString,
  release_date: nullableString,
  first_air_date: nullableString,
});
export const rawSearchSchema = z.object({
  page: z.number().int(),
  total_pages: z.number().int(),
  total_results: z.number().int(),
  results: z.array(z.unknown()),
});
export type RawSearchItem = z.infer<typeof searchItem>;

export const rawMovieSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  overview: nullableString,
  poster_path: nullableString,
  backdrop_path: nullableString,
  release_date: nullableString,
  status: nullableString,
});
export type RawMovie = z.infer<typeof rawMovieSchema>;

export const rawTvSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  original_name: z.string(),
  overview: nullableString,
  poster_path: nullableString,
  backdrop_path: nullableString,
  first_air_date: nullableString,
  status: nullableString,
  number_of_seasons: z
    .number()
    .int()
    .min(0)
    .nullish()
    .transform((v) => v ?? null),
  seasons: z
    .array(
      z.object({
        season_number: z.number().int().min(0),
        name: z.string(),
        air_date: nullableString,
        episode_count: z
          .number()
          .int()
          .min(0)
          .nullish()
          .transform((v) => v ?? null),
      }),
    )
    .default([]),
});
export type RawTv = z.infer<typeof rawTvSchema>;

export const rawSeasonSchema = z.object({
  season_number: z.number().int().min(0),
  name: z.string(),
  air_date: nullableString,
  episodes: z
    .array(
      z.object({
        episode_number: z.number().int().positive(),
        name: z.string(),
        air_date: nullableString,
        runtime: z
          .number()
          .int()
          .min(0)
          .nullish()
          .transform((v) => v ?? null),
      }),
    )
    .default([]),
});
export type RawSeason = z.infer<typeof rawSeasonSchema>;

export interface TmdbApi {
  searchMulti(
    query: string,
    page: number,
    locale: CatalogLocale,
  ): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: RawSearchItem[];
  }>;
  movie(tmdbId: number, locale: CatalogLocale): Promise<RawMovie>;
  tv(tmdbId: number, locale: CatalogLocale): Promise<RawTv>;
  season(tmdbId: number, seasonNumber: number, locale: CatalogLocale): Promise<RawSeason>;
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface TmdbClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: Fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}

/**
 * TMDB v3 client. Paths are built only from validated integers, so no caller
 * input can change the host or path (no SSRF). The token travels in the
 * Authorization header, never in the URL.
 */
export function createTmdbApi({
  baseUrl,
  token,
  fetchImpl = fetch,
  timeoutMs = 8000,
  retryDelayMs = 500,
}: TmdbClientOptions): TmdbApi {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  async function get<T>(
    path: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new TmdbError('upstream_unavailable');
      }

      if (response.ok) {
        const parsed = schema.safeParse(await response.json().catch(() => null));
        if (!parsed.success) throw new TmdbError('upstream_unavailable', response.status);
        return parsed.data;
      }
      await response.body?.cancel();
      if (response.status === 404) throw new TmdbError('not_found', 404);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 1) throw new TmdbError('upstream_unavailable', response.status);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    throw new TmdbError('upstream_unavailable');
  }

  return {
    async searchMulti(query, page, locale) {
      const raw = await get(
        '/search/multi',
        {
          query,
          page: String(page),
          language: TMDB_LANGUAGE[locale],
          include_adult: 'false',
        },
        rawSearchSchema,
      );
      // Skip people and anything malformed instead of failing the whole search.
      const results = raw.results.flatMap((item) => {
        const parsed = searchItem.safeParse(item);
        return parsed.success &&
          (parsed.data.media_type === 'movie' || parsed.data.media_type === 'tv')
          ? [parsed.data]
          : [];
      });
      return {
        page: raw.page,
        totalPages: raw.total_pages,
        totalResults: raw.total_results,
        results,
      };
    },
    movie: (tmdbId, locale) =>
      get(`/movie/${Math.trunc(tmdbId)}`, { language: TMDB_LANGUAGE[locale] }, rawMovieSchema),
    tv: (tmdbId, locale) =>
      get(`/tv/${Math.trunc(tmdbId)}`, { language: TMDB_LANGUAGE[locale] }, rawTvSchema),
    season: (tmdbId, seasonNumber, locale) =>
      get(
        `/tv/${Math.trunc(tmdbId)}/season/${Math.trunc(seasonNumber)}`,
        { language: TMDB_LANGUAGE[locale] },
        rawSeasonSchema,
      ),
  };
}
