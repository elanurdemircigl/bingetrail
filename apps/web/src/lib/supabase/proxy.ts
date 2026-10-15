import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

import type { Database } from '@bingetrail/db-types';

import { getSupabaseEnv } from '@/lib/env';

import { hardenCookieOptions } from './cookies';

/**
 * Refreshes the Supabase session for this request and writes rotated cookies
 * onto `response`. Returns the verified user id (or null).
 *
 * getClaims() validates the JWT (via JWKS, or the Auth server for symmetric
 * keys) — never trust getSession() on the server.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ response: NextResponse; userId: string | null }> {
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieOptions(options));
        }
        // Prevents CDNs from caching a response that carries a fresh session.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, userId: data?.claims.sub ?? null };
}
