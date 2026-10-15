import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import {
  createRecoveryMarker,
  hasRecoverySecret,
  RECOVERY_COOKIE,
  recoveryCookieOptions,
} from '@/lib/auth/recovery';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = ['email', 'recovery'] as const;
type ConfirmType = (typeof ALLOWED_TYPES)[number];

const isConfirmType = (value: string | null): value is ConfirmType =>
  (ALLOWED_TYPES as readonly (string | null)[]).includes(value);

/**
 * Target of the confirmation and recovery email links. The one-time token is
 * verified on the server and the resulting session is stored in HttpOnly
 * cookies; nothing sensitive is passed back to the browser in the URL.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const requestedLocale = params.get('locale');
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  if (tokenHash && isConfirmType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && type === 'email') redirect(`/${locale}/home`);
    if (!error && type === 'recovery') {
      // Mark THIS session as a recovery session (HttpOnly, signed, 15 min).
      const { data } = await supabase.auth.getClaims();
      const sessionId = data?.claims.session_id;
      const marker =
        data && typeof sessionId === 'string'
          ? createRecoveryMarker({ userId: data.claims.sub, sessionId })
          : null;
      if (marker) {
        (await cookies()).set(RECOVERY_COOKIE, marker, recoveryCookieOptions());
        redirect(`/${locale}/reset-password`);
      }
      if (!hasRecoverySecret())
        console.error('AUTH_COOKIE_SECRET is missing or too short; password reset is disabled.');
    }
  }

  redirect(`/${locale}/login?error=linkInvalid`);
}
