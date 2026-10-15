import type { Json } from '@bingetrail/db-types';
import type { CatalogLocale, MediaType, ProgressErrorCode } from '@bingetrail/shared';

import type { TypedSupabaseClient } from './client-type';
import { localizedTitle } from './watchlist';

/** A failed progress operation, reduced to a code the UI can translate. */
export class ProgressError extends Error {
  constructor(readonly code: ProgressErrorCode) {
    super(`progress operation failed: ${code}`);
    this.name = 'ProgressError';
  }
}

// The RPCs raise these exact messages (SQLSTATE 22023).
const RPC_CODES: readonly ProgressErrorCode[] = [
  'episode_not_aired',
  'episode_not_found',
  'too_many_episodes',
];

function fail(error: { message?: string } | null): never {
  throw new ProgressError(RPC_CODES.find((code) => code === error?.message) ?? 'unexpected');
}

/** Marks aired episodes as watched in ONE request; returns how many were new. */
export async function markEpisodesWatched(
  client: TypedSupabaseClient,
  episodeIds: number[],
): Promise<number> {
  const { data, error } = await client.rpc('mark_episodes_watched', { p_episode_ids: episodeIds });
  if (error) fail(error);
  return data ?? 0;
}

export async function unmarkEpisodes(
  client: TypedSupabaseClient,
  episodeIds: number[],
): Promise<number> {
  const { data, error } = await client.rpc('unmark_episodes', { p_episode_ids: episodeIds });
  if (error) fail(error);
  return data ?? 0;
}

/** Ids of the signed-in user's watched episodes of one title (RLS limits rows to the owner). */
export async function getWatchedEpisodeIds(
  client: TypedSupabaseClient,
  titleId: number,
): Promise<Set<number>> {
  const { data, error } = await client
    .from('episode_progress')
    .select('episode_id')
    .eq('title_id', titleId);
  if (error) fail(error);
  return new Set((data ?? []).map((row) => row.episode_id));
}

export type TitleProgressDTO = {
  airedCount: number;
  watchedCount: number;
  /** False while some aired season's episodes are not cached yet. */
  catalogComplete: boolean;
};

export async function getTitleProgress(
  client: TypedSupabaseClient,
  titleId: number,
): Promise<TitleProgressDTO> {
  const { data, error } = await client.rpc('get_title_progress', { p_title_id: titleId });
  if (error) fail(error);
  const row = data?.[0];
  return {
    airedCount: row?.aired_count ?? 0,
    watchedCount: row?.watched_count ?? 0,
    catalogComplete: row?.catalog_complete ?? false,
  };
}

export type ContinueWatchingDTO = {
  itemId: string;
  titleId: number;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  lastActivityAt: string;
  watchedCount: number;
  airedCount: number;
  /** Null for movies, finished series, or when the next season is not cached yet. */
  nextEpisode: {
    id: number;
    seasonNumber: number;
    episodeNumber: number;
    name: string | null;
    airDate: string | null;
  } | null;
};

/** Episode names are `{ "tr": "...", "en": "..." }`; falls back to any cached language. */
function localizedName(name: Json | null, locale: CatalogLocale): string | null {
  if (!name || typeof name !== 'object' || Array.isArray(name)) return null;
  const entries = name as Record<string, unknown>;
  const pick = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
  return pick(entries[locale]) ?? Object.values(entries).map(pick).find(Boolean) ?? null;
}

type ContinueWatchingRow = {
  item_id: string;
  title_id: number;
  tmdb_id: number;
  media_type: MediaType;
  original_title: string;
  translations: Json;
  poster_path: string | null;
  last_activity_at: string;
  next_episode_id: number | null;
  next_season_number: number | null;
  next_episode_number: number | null;
  next_episode_name: Json | null;
  next_air_date: string | null;
  watched_count: number;
  aired_count: number;
};

export function mapContinueWatching(
  row: ContinueWatchingRow,
  locale: CatalogLocale,
): ContinueWatchingDTO {
  return {
    itemId: row.item_id,
    titleId: row.title_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: localizedTitle(row.translations, locale, row.original_title),
    posterPath: row.poster_path,
    lastActivityAt: row.last_activity_at,
    watchedCount: row.watched_count,
    airedCount: row.aired_count,
    nextEpisode:
      row.next_episode_id !== null &&
      row.next_season_number !== null &&
      row.next_episode_number !== null
        ? {
            id: row.next_episode_id,
            seasonNumber: row.next_season_number,
            episodeNumber: row.next_episode_number,
            name: localizedName(row.next_episode_name, locale),
            airDate: row.next_air_date,
          }
        : null,
  };
}

/** Home screen: "watching" titles with their next episode, from a single query. */
export async function getContinueWatching(
  client: TypedSupabaseClient,
  locale: CatalogLocale,
  limit = 20,
): Promise<ContinueWatchingDTO[]> {
  const { data, error } = await client.rpc('get_continue_watching', { p_limit: limit });
  if (error) fail(error);
  // Generated types mark the LEFT JOIN columns non-null; they are nullable.
  return ((data ?? []) as ContinueWatchingRow[]).map((row) => mapContinueWatching(row, locale));
}
