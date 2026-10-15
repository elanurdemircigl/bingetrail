// Platform-independent data contracts shared by web and mobile:
// query keys, DTOs, mappers and data-access functions that RECEIVE a client.
// This package never creates a Supabase client or manages sessions — each app
// owns its own factory (web: @supabase/ssr + cookies, mobile: SecureStore).
export { queryKeys } from './query-keys';
export type { TypedSupabaseClient } from './client-type';
export {
  PROFILE_COLUMNS,
  getProfile,
  mapProfile,
  updateProfileLocale,
  type ProfileDTO,
} from './profile';
export { CatalogError, getSeasonDetail, getTitleDetail, searchCatalog } from './catalog';
export {
  WatchlistError,
  addToWatchlist,
  getWatchlist,
  getWatchlistCounts,
  getWatchlistItemForTitle,
  mapWatchlistItem,
  removeFromWatchlist,
  updateWatchlistDetails,
  updateWatchlistStatus,
  type WatchlistItemDTO,
} from './watchlist';
export { AccountError, deleteAccount } from './account';
export {
  ProgressError,
  getContinueWatching,
  getTitleProgress,
  getWatchedEpisodeIds,
  mapContinueWatching,
  markEpisodesWatched,
  unmarkEpisodes,
  type ContinueWatchingDTO,
  type TitleProgressDTO,
} from './progress';
export {
  getRealtimeTopic,
  measureClockOffset,
  parseSyncEvent,
  queryKeysForSyncEvent,
} from './sync';
