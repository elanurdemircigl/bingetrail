import {
  catalogRequestSchema,
  type CatalogLocale,
  type MediaType,
  type SeasonDetail,
  type SearchResponse,
  type TitleDetail,
} from '../_shared/contracts/catalog.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

import {
  isFresh,
  seasonInputFromTmdb,
  type SeasonInput,
  type SeasonWithEpisodes,
  type TitleInput,
  titleInputFromMovie,
  titleInputFromTv,
  type TitleRecord,
  toSearchResult,
  toSeasonDetail,
  toTitleDetail,
} from './catalog.ts';
import { TmdbError, type TmdbApi } from './tmdb-client.ts';

export interface CatalogStore {
  findTitle(mediaType: MediaType, tmdbId: number): Promise<TitleRecord | null>;
  saveTitle(input: TitleInput): Promise<TitleRecord>;
  touchTitle(titleId: number): Promise<void>;
  findSeason(titleId: number, seasonNumber: number): Promise<SeasonWithEpisodes | null>;
  saveSeason(titleId: number, input: SeasonInput): Promise<SeasonWithEpisodes>;
}

export interface Deps {
  /** Verifies the bearer token and returns the user id, or null. */
  authenticate(authorization: string | null): Promise<string | null>;
  /** Counts one request; false once the user is over the limit. */
  allowRequest(userId: string): Promise<boolean>;
  tmdb: TmdbApi;
  store: CatalogStore;
  now(): Date;
  allowedOrigins: readonly string[];
  /** Server-side diagnostics; must never receive tokens or request bodies. */
  logError(message: string): void;
}

const RATE_LIMIT_WINDOW_SECONDS = 60;

export function createHandler(deps: Deps) {
  async function loadTitle(
    mediaType: MediaType,
    tmdbId: number,
    locale: CatalogLocale,
  ): Promise<TitleRecord> {
    const cached = await deps.store.findTitle(mediaType, tmdbId);
    if (cached && isFresh(cached.fetchedAt, deps.now()) && cached.translations[locale]) {
      await deps.store.touchTitle(cached.id);
      return cached;
    }
    const input =
      mediaType === 'movie'
        ? titleInputFromMovie(await deps.tmdb.movie(tmdbId, locale), locale, cached)
        : titleInputFromTv(await deps.tmdb.tv(tmdbId, locale), locale, cached);
    return deps.store.saveTitle(input);
  }

  async function search(
    query: string,
    page: number,
    locale: CatalogLocale,
  ): Promise<SearchResponse> {
    const raw = await deps.tmdb.searchMulti(query, page, locale);
    return {
      results: raw.results.map(toSearchResult),
      page: raw.page,
      totalPages: raw.totalPages,
      totalResults: raw.totalResults,
    };
  }

  async function title(
    mediaType: MediaType,
    tmdbId: number,
    locale: CatalogLocale,
  ): Promise<TitleDetail> {
    return toTitleDetail(await loadTitle(mediaType, tmdbId, locale), locale);
  }

  async function season(
    tmdbId: number,
    seasonNumber: number,
    locale: CatalogLocale,
  ): Promise<SeasonDetail> {
    const show = await loadTitle('tv', tmdbId, locale);
    const cached = await deps.store.findSeason(show.id, seasonNumber);
    // Saving a show creates season rows without episodes; those are summaries,
    // not a cached season, so an empty episode list must never count as complete.
    const complete =
      !!cached &&
      cached.episodes.length > 0 &&
      cached.episodes.every((e) => e.name[locale] !== undefined);
    if (cached && complete && cached.name[locale] && isFresh(cached.fetchedAt, deps.now())) {
      return toSeasonDetail(cached, tmdbId, locale);
    }
    const raw = await deps.tmdb.season(tmdbId, seasonNumber, locale);
    const saved = await deps.store.saveSeason(show.id, seasonInputFromTmdb(raw, locale, cached));
    return toSeasonDetail(saved, tmdbId, locale);
  }

  return async function handle(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'), deps.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')
      return errorResponse('invalid_request', { ...cors, Allow: 'POST, OPTIONS' });

    const userId = await deps.authenticate(request.headers.get('Authorization')).catch(() => null);
    if (!userId) return errorResponse('unauthorized', cors);

    const body = await request.json().catch(() => undefined);
    const parsed = catalogRequestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('invalid_request', cors);

    try {
      if (!(await deps.allowRequest(userId))) {
        return errorResponse('rate_limited', {
          ...cors,
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }

      const req = parsed.data;
      switch (req.action) {
        case 'search':
          return json(await search(req.query, req.page, req.locale), 200, cors);
        case 'title':
          return json(await title(req.mediaType, req.tmdbId, req.locale), 200, cors);
        case 'season':
          return json(await season(req.tmdbId, req.seasonNumber, req.locale), 200, cors);
      }
    } catch (error) {
      if (error instanceof TmdbError) {
        if (error.kind === 'upstream_unavailable')
          deps.logError(`tmdb upstream error status=${error.status ?? 'network'}`);
        return errorResponse(error.kind, cors);
      }
      deps.logError(
        `tmdb function internal error: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      return errorResponse('internal', cors);
    }
  };
}
