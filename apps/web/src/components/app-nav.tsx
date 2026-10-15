'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';

const ITEMS = [
  { href: '/home', key: 'home' },
  { href: '/search', key: 'search' },
  { href: '/list', key: 'list' },
  { href: '/calendar', key: 'calendar' },
  { href: '/profile', key: 'profile' },
] as const;

export function AppNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('mainNav')}>
      <ul className="flex flex-wrap gap-1">
        {ITEMS.map(({ href, key }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
