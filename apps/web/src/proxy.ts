import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { isValidRecoveryMarker, RECOVERY_COOKIE } from '@/lib/auth/recovery';
import { classifyPath } from '@/lib/routes';
import { updateSession } from '@/lib/supabase/proxy';

const handleI18nRouting = createMiddleware(routing);

/**
 * Runs before every page: locale routing (next-intl), Supabase session refresh
 * and the first line of access control. Protected layouts re-check the user on
 * the server as defence in depth.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Auth callback (e.g. /auth/confirm) is locale-less; it only needs session cookies.
  if (pathname.startsWith('/auth/')) {
    return (await updateSession(request, NextResponse.next({ request }))).response;
  }

  const i18nResponse = handleI18nRouting(request);
  if (i18nResponse.headers.has('location')) return i18nResponse;

  const { response, userId, sessionId } = await updateSession(request, i18nResponse);
  const { locale, kind } = classifyPath(pathname);

  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    // Keep any refreshed session cookies on the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!userId && kind === 'protected') {
    const next = encodeURIComponent(`${pathname}${search}`);
    return redirectTo(`/${locale}/login?next=${next}`);
  }
  if (kind === 'recovery') {
    if (!userId) return redirectTo(`/${locale}/forgot-password`);
    // A normal session (password or signup-confirmation login) may not use the
    // reset form; only a fresh recovery-email session carries a valid marker.
    const marker = request.cookies.get(RECOVERY_COOKIE)?.value;
    const binding = sessionId ? { userId, sessionId } : null;
    if (!isValidRecoveryMarker(marker, binding)) return redirectTo(`/${locale}/profile`);
  }
  if (userId && kind === 'guest-only') return redirectTo(`/${locale}/home`);

  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
