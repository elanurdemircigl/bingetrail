import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { TypedSupabaseClient } from '@bingetrail/api-client';
import type { Database } from '@bingetrail/db-types';

import { getSupabaseEnv } from '@/lib/env';

import { hardenCookieOptions } from './cookies';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create one per request; never share it across requests.
 */
export async function createClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookieOptions(options));
          }
        } catch {
          // Server Components cannot set cookies; the proxy already refreshed the session.
        }
      },
    },
  });
}
