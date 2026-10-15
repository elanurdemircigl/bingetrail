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
  type WatchlistItemDTO,
} from '@bingetrail/api-client';
import type { CatalogLocale, MediaType, WatchlistSort, WatchStatus } from '@bingetrail/shared';
import { applyStatusChange } from '@bingetrail/shared';

import { supabase } from './supabase/client';

// Thin TanStack layer over @bingetrail/api-client: the same keys and data-access
// functions the web uses, called with the mobile client. No API changes needed.

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (not found, invalid) do not get better by retrying.
        retry: (count, error) =>
          count < 2 && !(error instanceof CatalogError && error.code !== 'upstream_unavailable'),
      },
    },
  });
}

const now = () => new Date().toISOString();

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

/** After any list or progress change: lists, counts, Continue Watching. */
function useInvalidateUserData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all }),
    ]);
}

export function useAddToWatchlist() {
  const invalidate = useInvalidateUserData();
  return useMutation({
    mutationFn: (input: { titleId: number; status: WatchStatus }) =>
      addToWatchlist(supabase, input, now()),
    onSettled: invalidate,
  });
}

/** Optimistic status change for one title's entry; rolls back on failure. */
export function useUpdateStatus(titleId: number) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateUserData();
  const key = queryKeys.watchlist.forTitle(titleId);
  return useMutation({
    mutationFn: (input: { itemId: string; status: WatchStatus }) =>
      updateWatchlistStatus(supabase, input.itemId, input.status, now()),
    onMutate: async ({ status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WatchlistItemDTO | null>(key);
      if (previous) {
        const dates = applyStatusChange(previous, status, now());
        queryClient.setQueryData<WatchlistItemDTO>(key, { ...previous, ...dates });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous);
    },
    onSettled: invalidate,
  });
}

export function useUpdateDetails() {
  const invalidate = useInvalidateUserData();
  return useMutation({
    mutationFn: (input: { itemId: string; rating: number | null; notes: string | null }) =>
      updateWatchlistDetails(supabase, input.itemId, input, now()),
    onSettled: invalidate,
  });
}

export function useRemoveFromWatchlist() {
  const invalidate = useInvalidateUserData();
  return useMutation({
    mutationFn: (itemId: string) => removeFromWatchlist(supabase, itemId),
    onSettled: invalidate,
  });
}

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
  const invalidate = useInvalidateUserData();
  const key = queryKeys.progress.title(titleId);
  return useMutation({
    mutationFn: ({ ids, watched }: { ids: number[]; watched: boolean }) =>
      watched ? markEpisodesWatched(supabase, ids) : unmarkEpisodes(supabase, ids),
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
    onSettled: invalidate,
  });
}
