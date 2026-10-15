import { cookies } from 'next/headers';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import { isValidRecoveryMarker, RECOVERY_COOKIE } from './recovery';

export type SessionUser = { id: string; email: string | null; sessionId: string | null };

/** Verified current user for this request (deduplicated per render). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { sub, email, session_id: sessionId } = data.claims;
  return {
    id: sub,
    email: typeof email === 'string' ? email : null,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
  };
});

/** True only for a session started by a recovery email link in the last 15 minutes. */
export async function isRecoverySession(user: SessionUser | null): Promise<boolean> {
  if (!user?.sessionId) return false;
  const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
  return isValidRecoveryMarker(marker, { userId: user.id, sessionId: user.sessionId });
}
