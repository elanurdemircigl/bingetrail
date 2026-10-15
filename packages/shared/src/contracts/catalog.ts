// Wire contract between clients and the `tmdb` Edge Function.
// SOURCE OF TRUTH. `pnpm contracts:sync` copies this file verbatim (plus a
// header) to supabase/functions/_shared/contracts/catalog.ts; CI fails if the
// copies drift. Keep it dependency-free except for `zod` so Deno can import it.
import { z } from 'zod';

export const CATALOG_LOCALES = ['tr', 'en'] as const;
export const catalogLocaleSchema = z.enum(CATALOG_LOCALES);
export type CatalogLocale = z.infer<typeof catalogLocaleSchema>;

export const mediaTypeSchema = z.enum(['movie', 'tv']);
export type MediaType = z.infer<typeof mediaTypeSchema>;

const tmdbIdSchema = z.number().int().positive().max(100_000_000);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const imagePathSchema = z.string().regex(/^\/[A-Za-z0-9._-]+$/);

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
export const searchRequestSchema = z.object({
  action: z.literal('search'),
  query: z.string().trim().min(1).max(100),
  page: z.number().int().min(1).max(20).default(1),
  locale: catalogLocaleSchema,
});

export const titleRequestSchema = z.object({
  action: z.literal('title'),
  mediaType: mediaTypeSchema,
  tmdbId: tmdbIdSchema,
  locale: catalogLocaleSchema,
});

export const seasonRequestSchema = z.object({
  action: z.literal('season'),
  tmdbId: tmdbIdSchema,
  seasonNumber: z.number().int().min(0).max(500),
  locale: catalogLocaleSchema,
});

export const catalogRequestSchema = z.discriminatedUnion('action', [
  searchRequestSchema,
  titleRequestSchema,
  seasonRequestSchema,
]);
export type CatalogRequest = z.input<typeof catalogRequestSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------
export const searchResultSchema = z.object({
  tmdbId: tmdbIdSchema,
  mediaType: mediaTypeSchema,
  title: z.string(),
  originalTitle: z.string(),
  overview: z.string().nullable(),
  posterPath: imagePathSchema.nullable(),
  releaseDate: isoDateSchema.nullable(),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  page: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  totalResults: z.number().int().min(0),
});

export const seasonSummarySchema = z.object({
  seasonNumber: z.number().int().min(0),
  name: z.string(),
  airDate: isoDateSchema.nullable(),
  episodeCount: z.number().int().min(0).nullable(),
});

export const titleDetailSchema = z.object({
  id: z.number().int().positive(),
  tmdbId: tmdbIdSchema,
  mediaType: mediaTypeSchema,
  title: z.string(),
  originalTitle: z.string(),
  overview: z.string().nullable(),
  posterPath: imagePathSchema.nullable(),
  backdropPath: imagePathSchema.nullable(),
  releaseDate: isoDateSchema.nullable(),
  status: z.string().nullable(),
  numberOfSeasons: z.number().int().min(0).nullable(),
  seasons: z.array(seasonSummarySchema),
});

export const episodeSchema = z.object({
  id: z.number().int().positive(),
  episodeNumber: z.number().int().positive(),
  name: z.string(),
  airDate: isoDateSchema.nullable(),
  runtime: z.number().int().min(0).nullable(),
});

export const seasonDetailSchema = z.object({
  titleId: z.number().int().positive(),
  tmdbId: tmdbIdSchema,
  seasonNumber: z.number().int().min(0),
  name: z.string(),
  airDate: isoDateSchema.nullable(),
  episodes: z.array(episodeSchema),
});

export const CATALOG_ERROR_CODES = [
  'unauthorized',
  'invalid_request',
  'rate_limited',
  'not_found',
  'upstream_unavailable',
  'internal',
] as const;
export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];
export const catalogErrorSchema = z.object({ error: z.enum(CATALOG_ERROR_CODES) });

export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type TitleDetail = z.infer<typeof titleDetailSchema>;
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;
export type SeasonDetail = z.infer<typeof seasonDetailSchema>;
export type Episode = z.infer<typeof episodeSchema>;
