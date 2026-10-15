import type { AuthErrorCode } from './auth';

type SupabaseAuthError =
  { code?: string | undefined; status?: number | undefined } | null | undefined;

/**
 * Maps a Supabase Auth error to a user-facing code. Anything not explicitly
 * known collapses into `fallback`, so responses never reveal whether an
 * account exists (e.g. "user not found" vs "wrong password").
 */
export function toAuthErrorCode(error: SupabaseAuthError, fallback: AuthErrorCode): AuthErrorCode {
  switch (error?.code) {
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
    case 'weak_password':
      return 'weakPassword';
    case 'same_password':
      return 'samePassword';
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return 'reauthRequired';
    default:
      return error?.status === 429 ? 'rateLimited' : fallback;
  }
}
