import type { CookieOptions } from '@supabase/ssr';

/**
 * Session cookies are HttpOnly: the web app never reads the session in the
 * browser (auth runs in Server Actions, Route Handlers and the proxy), so
 * client-side scripts — including any injected ones — cannot steal tokens.
 * See docs/adr/0002-web-auth.md.
 */
export function hardenCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
