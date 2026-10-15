import type { CatalogLocale, MediaType, WatchlistSort, WatchStatus } from '@bingetrail/shared';

/**
 * TanStack Query key factory. Keys are hierarchical so a whole domain can be
 * invalidated with its root key. Domains are added phase by phase.
 */
const root = ['bingetrail'] as const;

export const queryKeys = {
  all: root,
  profile: {
    all: [...root, 'profile'] as const,
    detail: (userId: string) => [...root, 'profile', userId] as const,
  },
  catalog: {
    all: [...root, 'catalog'] as const,
    search: (locale: CatalogLocale, query: string, page = 1) =>
      [...root, 'catalog', 'search', locale, query.trim().toLowerCase(), page] as const,
    title: (mediaType: MediaType, tmdbId: number, locale: CatalogLocale) =>
      [...root, 'catalog', 'title', mediaType, tmdbId, locale] as const,
    season: (tmdbId: number, seasonNumber: number, locale: CatalogLocale) =>
      [...root, 'catalog', 'season', tmdbId, seasonNumber, locale] as const,
  },
  watchlist: {
    all: [...root, 'watchlist'] as const,
    list: (status: WatchStatus | null, sort: WatchlistSort, locale: CatalogLocale) =>
      [...root, 'watchlist', 'list', status ?? 'all', sort, locale] as const,
    counts: () => [...root, 'watchlist', 'counts'] as const,
    forTitle: (titleId: number) => [...root, 'watchlist', 'title', titleId] as const,
  },
} as const;
