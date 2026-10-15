import type { z } from 'zod';

import {
  catalogErrorSchema,
  searchResponseSchema,
  seasonDetailSchema,
  titleDetailSchema,
  type CatalogErrorCode,
  type CatalogLocale,
  type CatalogRequest,
  type MediaType,
  type SearchResponse,
  type SeasonDetail,
  type TitleDetail,
} from '@bingetrail/shared';

import type { TypedSupabaseClient } from './client-type';

/** A failed catalog call, reduced to a contract error code (never upstream details). */
export class CatalogError extends Error {
  constructor(readonly code: CatalogErrorCode) {
    super(`catalog request failed: ${code}`);
    this.name = 'CatalogError';
  }
}

type JsonBody = { json(): Promise<unknown> };
const hasJsonBody = (value: unknown): value is JsonBody =>
  typeof value === 'object' && value !== null && typeof (value as JsonBody).json === 'function';

async function invokeCatalog<T>(
  client: TypedSupabaseClient,
  body: CatalogRequest,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await client.functions.invoke('tmdb', { body });

  if (error) {
    // FunctionsHttpError carries the function's Response; anything else is a relay/network failure.
    const context: unknown = (error as { context?: unknown }).context;
    if (hasJsonBody(context)) {
      const parsed = catalogErrorSchema.safeParse(await context.json().catch(() => null));
      throw new CatalogError(parsed.success ? parsed.data.error : 'internal');
    }
    throw new CatalogError('upstream_unavailable');
  }

  // Validate the response too: a contract drift must fail loudly, not render garbage.
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new CatalogError('internal');
  return parsed.data;
}

export function searchCatalog(
  client: TypedSupabaseClient,
  params: { query: string; page?: number; locale: CatalogLocale },
): Promise<SearchResponse> {
  return invokeCatalog(client, { action: 'search', page: 1, ...params }, searchResponseSchema);
}

export function getTitleDetail(
  client: TypedSupabaseClient,
  params: { mediaType: MediaType; tmdbId: number; locale: CatalogLocale },
): Promise<TitleDetail> {
  return invokeCatalog(client, { action: 'title', ...params }, titleDetailSchema);
}

export function getSeasonDetail(
  client: TypedSupabaseClient,
  params: { tmdbId: number; seasonNumber: number; locale: CatalogLocale },
): Promise<SeasonDetail> {
  return invokeCatalog(client, { action: 'season', ...params }, seasonDetailSchema);
}
