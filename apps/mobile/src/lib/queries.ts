import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  addToWatchlist,
  CatalogError,
  getContinueWatching,
  getSeasonDetail,
  getTitleDetail,
  getTitleProgress,
  getWatchedEpisodeIds,
  getWatchlist,
  getWatchlistCounts,
  getWatchlistItemForTitle,
  markEpisodesWatched,
  queryKeys,
  removeFromWatchlist,
  searchCatalog,
  unmarkEpisodes,
  updateWatchlistDetails,
  updateWatchlistStatus,
  WatchlistError,
  type WatchlistItemDTO,
} from '@bingetrail/api-client';
import type { CatalogLocale, MediaType, WatchlistSort, WatchStatus } from '@bingetrail/shared';
import { applyStatusChange } from '@bingetrail/shared';

import { supabase } from './supabase/client';
import { serverNowIso } from './sync/clock';

// Thin TanStack layer over @bingetrail/api-client: the same keys and data-access
// functions the web uses, called with the mobile client. No API changes needed.
//
// Writes are registered as mutation DEFAULTS (keyed, serializable variables) so
// that edits made offline can be persisted and replayed after an app restart
// (docs/sync.md). Conflicts: last write to reach the server wins, per field
// group (status vs rating/notes); episode marks are idempotent.

export const MUTATION_KEYS = {
  add: ['watchlist', 'add'],
  status: ['watchlist', 'status'],
  details: ['watchlist', 'details'],
  remove: ['watchlist', 'remove'],
  episodes: ['progress', 'episodes'],
} as const;

export type AddVars = { titleId: number; status: WatchStatus };
export type StatusVars = { itemId: string; status: WatchStatus };
export type DetailsVars = { itemId: string; rating: number | null; notes: string | null };
export type RemoveVars = { itemId: string };
export type EpisodesVars = { titleId: number; ids: number[]; watched: boolean };

/**
 * One scope for every write: queued changes are sent strictly in the order they
 * were made (TanStack runs unscoped mutations in parallel).
 */
const WRITE_SCOPE = { id: 'bingetrail-writes' };

/** Replays of already-applied effects are successes, not errors. */
const ignore = (error: unknown, code: string) => {
  if (error instanceof WatchlistError && error.code === code) return;
  throw error;
};

/** Mutation functions by key; used live and when replaying the offline queue. */
export function registerMutationDefaults(client: QueryClient) {
  const settle = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.watchlist.all }),
      client.invalidateQueries({ queryKey: queryKeys.progress.all }),
    ]);

  client.setMutationDefaults(MUTATION_KEYS.add, {
    scope: WRITE_SCOPE,
    mutationFn: async ({ titleId, status }: AddVars) =>
      // Added meanwhile on another device: the title is on the list either way.
      addToWatchlist(supabase, { titleId, status }, await serverNowIso()).catch((e: unknown) =>
        ignore(e, 'already_exists'),
      ),
    onSettled: settle,
  });
  client.setMutationDefaults(MUTATION_KEYS.status, {
    scope: WRITE_SCOPE,
    mutationFn: async ({ itemId, status }: StatusVars) =>
      updateWatchlistStatus(supabase, itemId, status, await serverNowIso()),
    onSettled: settle,
  });
  client.setMutationDefaults(MUTATION_KEYS.details, {
    scope: WRITE_SCOPE,
    mutationFn: async ({ itemId, rating, notes }: DetailsVars) =>
      updateWatchlistDetails(supabase, itemId, { rating, notes }, await serverNowIso()),
    onSettled: settle,
  });
  client.setMutationDefaults(MUTATION_KEYS.remove, {
    scope: WRITE_SCOPE,
    mutationFn: ({ itemId }: RemoveVars) =>
      // Already removed elsewhere: the goal is reached.
      removeFromWatchlist(supabase, itemId).catch((e: unknown) => ignore(e, 'not_found')),
    onSettled: settle,
  });
  client.setMutationDefaults(MUTATION_KEYS.episodes, {
    scope: WRITE_SCOPE,
    mutationFn: ({ ids, watched }: EpisodesVars) =>
      watched ? markEpisodesWatched(supabase, ids) : unmarkEpisodes(supabase, ids),
    onSettled: settle,
  });
}

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Persisted for offline use; see sync/persist.ts.
        gcTime: 7 * 24 * 60 * 60 * 1000,
        // Client errors (not found, invalid) do not get better by retrying.
        retry: (count, error) =>
          count < 2 && !(error instanceof CatalogError && error.code !== 'upstream_unavailable'),
      },
    },
  });
  registerMutationDefaults(client);
  return client;
}

// ---------------------------------------------------------------- catalog
export const useSearch = (query: string, page: number, locale: CatalogLocale) =>
  useQuery({
    queryKey: queryKeys.catalog.search(locale, query, page),
    queryFn: () => searchCatalog(supabase, { query, page, locale }),
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
  });

export const useTitle = (mediaType: MediaType, tmdbId: number, locale: CatalogLocale) =>
  useQuery({
    queryKey: queryKeys.catalog.title(mediaType, tmdbId, locale),
    queryFn: () => getTitleDetail(supabase, { mediaType, tmdbId, locale }),
  });

export const useSeason = (tmdbId: number, seasonNumber: number, locale: CatalogLocale) =>
  useQuery({
    queryKey: queryKeys.catalog.season(tmdbId, seasonNumber, locale),
    queryFn: () => getSeasonDetail(supabase, { tmdbId, seasonNumber, locale }),
  });

// ---------------------------------------------------------------- watchlist
export const useWatchlist = (
  status: WatchStatus | null,
  sort: WatchlistSort,
  locale: CatalogLocale,
) =>
  useQuery({
    queryKey: queryKeys.watchlist.list(status, sort, locale),
    queryFn: () => getWatchlist(supabase, { status, sort, locale }),
  });

export const useWatchlistCounts = () =>
  useQuery({ queryKey: queryKeys.watchlist.counts(), queryFn: () => getWatchlistCounts(supabase) });

export const useWatchlistItem = (titleId: number | undefined, locale: CatalogLocale) =>
  useQuery({
    queryKey: queryKeys.watchlist.forTitle(titleId ?? 0),
    queryFn: () => getWatchlistItemForTitle(supabase, titleId ?? 0, locale),
    enabled: titleId !== undefined,
  });

export const useAddToWatchlist = () =>
  useMutation<void, Error, AddVars>({ mutationKey: MUTATION_KEYS.add });

/** Optimistic status change for one title's entry; rolls back on failure. */
export function useUpdateStatus(titleId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.watchlist.forTitle(titleId);
  return useMutation<void, Error, StatusVars, { previous: WatchlistItemDTO | null | undefined }>({
    mutationKey: MUTATION_KEYS.status,
    onMutate: async ({ status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WatchlistItemDTO | null>(key);
      if (previous) {
        const dates = applyStatusChange(previous, status, new Date().toISOString());
        queryClient.setQueryData<WatchlistItemDTO>(key, { ...previous, ...dates });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous);
    },
  });
}

export const useUpdateDetails = () =>
  useMutation<void, Error, DetailsVars>({ mutationKey: MUTATION_KEYS.details });

export const useRemoveFromWatchlist = () =>
  useMutation<void, Error, RemoveVars>({ mutationKey: MUTATION_KEYS.remove });

// ---------------------------------------------------------------- progress
export const useWatchedEpisodes = (titleId: number | undefined) =>
  useQuery({
    queryKey: queryKeys.progress.title(titleId ?? 0),
    queryFn: () => getWatchedEpisodeIds(supabase, titleId ?? 0),
    enabled: titleId !== undefined,
  });

export const useTitleProgress = (titleId: number | undefined) =>
  useQuery({
    queryKey: [...queryKeys.progress.title(titleId ?? 0), 'summary'],
    queryFn: () => getTitleProgress(supabase, titleId ?? 0),
    enabled: titleId !== undefined,
  });

export const useContinueWatching = (locale: CatalogLocale) =>
  useQuery({
    queryKey: queryKeys.progress.continueWatching(locale),
    queryFn: () => getContinueWatching(supabase, locale),
  });

/** One request per call, optimistic on the title's watched set. */
export function useSetEpisodesWatched(titleId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.progress.title(titleId);
  return useMutation<
    number,
    Error,
    Omit<EpisodesVars, 'titleId'> & { titleId?: number },
    { previous: Set<number> | undefined }
  >({
    mutationKey: MUTATION_KEYS.episodes,
    onMutate: async ({ ids, watched }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<Set<number>>(key);
      const next = new Set(previous);
      for (const id of ids) {
        if (watched) next.add(id);
        else next.delete(id);
      }
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
  });
}
