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
