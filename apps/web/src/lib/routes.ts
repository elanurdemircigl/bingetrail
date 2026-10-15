import { hasLocale } from 'next-intl';

import { routing } from '@/i18n/routing';

type Locale = (typeof routing.locales)[number];

/** Pages that require a signed-in user. */
export const PROTECTED_SECTIONS = [
  '/home',
  '/search',
  '/title',
  '/list',
  '/calendar',
  '/profile',
] as const;
/** Pages that only make sense for guests; signed-in users are sent to /home. */
export const GUEST_ONLY_SECTIONS = ['/login', '/signup', '/forgot-password'] as const;
/** Requires a (recovery) session; without one the user must request a new link. */
export const RECOVERY_SECTION = '/reset-password';

export type RouteKind = 'protected' | 'guest-only' | 'recovery' | 'public';

const within = (section: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => section === prefix || section.startsWith(`${prefix}/`));

/** Splits `/tr/list/123` into locale `tr`, section `/list/123` and its access kind. */
export function classifyPath(pathname: string): {
  locale: Locale;
  section: string;
  kind: RouteKind;
} {
  const [, first = '', ...rest] = pathname.split('/');
  const hasPrefix = hasLocale(routing.locales, first);
  const locale = hasPrefix ? first : routing.defaultLocale;
  const section = `/${(hasPrefix ? rest : [first, ...rest]).join('/')}`.replace(/\/+$/, '') || '/';

  const kind: RouteKind = within(section, PROTECTED_SECTIONS)
    ? 'protected'
    : within(section, GUEST_ONLY_SECTIONS)
      ? 'guest-only'
      : section === RECOVERY_SECTION
        ? 'recovery'
        : 'public';

  return { locale, section, kind };
}
