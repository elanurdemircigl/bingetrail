'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** Guest language switch: same page, other locale (signed-in users use Profile). */
export function LanguageSwitcher() {
  const t = useTranslations('languages');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex gap-2 text-sm">
      {routing.locales.map((locale) =>
        locale === current ? (
          <span key={locale} aria-current="true" className="font-semibold">
            {t(locale)}
          </span>
        ) : (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            className="text-ink-muted hover:text-ink"
          >
            {t(locale)}
          </Link>
        ),
      )}
    </nav>
  );
}
