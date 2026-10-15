import type { Json } from '@bingetrail/db-types';
import type { CatalogLocale } from '@bingetrail/shared';
import {
  applyStatusChange,
  WATCH_STATUSES,
  type MediaType,
  type WatchlistErrorCode,
  type WatchlistSort,
  type WatchStatus,
} from '@bingetrail/shared';

import type { TypedSupabaseClient } from './client-type';

/** A failed list operation, reduced to a code the UI can translate. */
export class WatchlistError extends Error {
  constructor(readonly code: WatchlistErrorCode) {
    super(`watchlist operation failed: ${code}`);
    this.name = 'WatchlistError';
  }
}

export type WatchlistItemDTO = {
  id: string;
  titleId: number;
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  title: {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    originalTitle: string;
    posterPath: string | null;
    releaseDate: string | null;
  };
};

const ITEM_COLUMNS =
  'id, title_id, status, rating, notes, started_at, completed_at, last_activity_at, created_at, ' +
  'titles(tmdb_id, media_type, original_title, translations, poster_path, release_date)';

type ItemRow = {
  id: string;
  title_id: number;
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  created_at: string;
  titles: {
    tmdb_id: number;
    media_type: MediaType;
    original_title: string;
    translations: Json;
    poster_path: string | null;
    release_date: string | null;
  } | null;
};

/** Localized title text: requested locale, then any cached locale, then the original. */
function localizedTitle(translations: Json, locale: CatalogLocale, original: string): string {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations))
    return original;
  const entries = translations as Record<string, { title?: unknown } | undefined>;
  const pick = (key: string) => {
    const value = entries[key]?.title;
    return typeof value === 'string' && value.trim() ? value : null;
  };
  return (
    pick(locale) ??
    Object.keys(entries)
      .map(pick)
      .find((v) => v !== null) ??
    original
  );
}

export function mapWatchlistItem(row: ItemRow, locale: CatalogLocale): WatchlistItemDTO {
  const title = row.titles;
  return {
    id: row.id,
    titleId: row.title_id,
    status: row.status,
    rating: row.rating,
    notes: row.notes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    title: {
      tmdbId: title?.tmdb_id ?? 0,
      mediaType: title?.media_type ?? 'movie',
      title: title ? localizedTitle(title.translations, locale, title.original_title) : '',
      originalTitle: title?.original_title ?? '',
      posterPath: title?.poster_path ?? null,
      releaseDate: title?.release_date ?? null,
    },
  };
}

function fail(error: { code?: string } | null): never {
  throw new WatchlistError(error?.code === '23505' ? 'already_exists' : 'unexpected');
}

/** The signed-in user's list (RLS limits rows to the owner). */
export async function getWatchlist(
  client: TypedSupabaseClient,
  params: { status: WatchStatus | null; sort: WatchlistSort; locale: CatalogLocale },
): Promise<WatchlistItemDTO[]> {
  let query = client.from('watchlist_items').select(ITEM_COLUMNS);
  if (params.status) query = query.eq('status', params.status);
  if (params.sort === 'added') query = query.order('created_at', { ascending: false });
  else if (params.sort === 'rating') {
    query = query
      .order('rating', { ascending: false, nullsFirst: false })
      .order('last_activity_at', { ascending: false });
  } else query = query.order('last_activity_at', { ascending: false });

  const { data, error } = await query;
  if (error) fail(error);
  const items = (data as unknown as ItemRow[]).map((row) => mapWatchlistItem(row, params.locale));
  // Titles are localized JSON, so alphabetical order is applied here, locale-aware.
  if (params.sort === 'title') {
    const collator = new Intl.Collator(params.locale, { sensitivity: 'base' });
    items.sort((a, b) => collator.compare(a.title.title, b.title.title));
  }
  return items;
}

/** Number of list entries per status (lists are small; counted client-side). */
export async function getWatchlistCounts(
  client: TypedSupabaseClient,
): Promise<Record<WatchStatus, number>> {
  const { data, error } = await client.from('watchlist_items').select('status');
  if (error) fail(error);
  const counts = Object.fromEntries(WATCH_STATUSES.map((s) => [s, 0])) as Record<
    WatchStatus,
    number
  >;
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

export async function getWatchlistItemForTitle(
  client: TypedSupabaseClient,
  titleId: number,
  locale: CatalogLocale,
): Promise<WatchlistItemDTO | null> {
  const { data, error } = await client
    .from('watchlist_items')
    .select(ITEM_COLUMNS)
    .eq('title_id', titleId)
    .maybeSingle();
  if (error) fail(error);
  return data ? mapWatchlistItem(data as unknown as ItemRow, locale) : null;
}

export async function addToWatchlist(
  client: TypedSupabaseClient,
  input: { titleId: number; status: WatchStatus },
  nowIso: string,
): Promise<string> {
  const dates = applyStatusChange(null, input.status, nowIso);
  const { data, error } = await client
    .from('watchlist_items')
    .insert({
      title_id: input.titleId,
      status: dates.status,
      started_at: dates.startedAt,
      completed_at: dates.completedAt,
      last_activity_at: nowIso,
    })
    .select('id')
    .single();
  if (error) fail(error);
  return data.id;
}

export async function updateWatchlistStatus(
  client: TypedSupabaseClient,
  itemId: string,
  status: WatchStatus,
  nowIso: string,
): Promise<void> {
  const current = await client
    .from('watchlist_items')
    .select('started_at, completed_at')
    .eq('id', itemId)
    .maybeSingle();
  if (current.error) fail(current.error);
  if (!current.data) throw new WatchlistError('not_found');

  const dates = applyStatusChange(
    { startedAt: current.data.started_at, completedAt: current.data.completed_at },
    status,
    nowIso,
  );
  const { data, error } = await client
    .from('watchlist_items')
    .update({
      status: dates.status,
      started_at: dates.startedAt,
      completed_at: dates.completedAt,
      last_activity_at: nowIso,
    })
    .eq('id', itemId)
    .select('id');
  if (error) fail(error);
  if (!data?.length) throw new WatchlistError('not_found');
}

export async function updateWatchlistDetails(
  client: TypedSupabaseClient,
  itemId: string,
  details: { rating: number | null; notes: string | null },
  nowIso: string,
): Promise<void> {
  const { data, error } = await client
    .from('watchlist_items')
    .update({ rating: details.rating, notes: details.notes, last_activity_at: nowIso })
    .eq('id', itemId)
    .select('id');
  if (error) fail(error);
  if (!data?.length) throw new WatchlistError('not_found');
}

export async function removeFromWatchlist(
  client: TypedSupabaseClient,
  itemId: string,
): Promise<void> {
  const { data, error } = await client
    .from('watchlist_items')
    .delete()
    .eq('id', itemId)
    .select('id');
  if (error) fail(error);
  if (!data?.length) throw new WatchlistError('not_found');
}
