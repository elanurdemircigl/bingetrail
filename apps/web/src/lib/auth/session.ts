import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export type SessionUser = { id: string; email: string | null };

/** Verified current user for this request (deduplicated per render). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === 'string' ? email : null };
});
