import { getTranslations } from 'next-intl/server';

import { getRealtimeTopic } from '@bingetrail/api-client';

import { AppNav } from '@/components/app-nav';
import { LiveSync } from '@/components/live-sync';
import { SignOutButton } from '@/components/sign-out-button';
import { Link, redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/** Shell for signed-in pages. Re-checks the session even though the proxy already did. */
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  if (!(await getSessionUser())) redirect({ href: '/login', locale });
  const t = await getTranslations();
  // Per-user sync topic (no token reaches the browser; see LiveSync).
  const topic = await getRealtimeTopic(await createClient());

  return (
    <div className="min-h-screen">
      <header className="border-surface-muted border-b">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/home" className="text-brand-500 text-lg font-bold">
            {t('app.name')}
          </Link>
          <AppNav />
          <div className="flex items-center gap-3">
            <LiveSync topic={topic} />
            <SignOutButton label={t('nav.signOut')} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8">{children}</main>
      {/* TMDB terms of use require this attribution wherever their data is shown. */}
      <footer className="border-surface-muted text-ink-muted mx-auto max-w-4xl border-t px-6 py-6 text-xs">
        <p>
          {t('catalog.attribution')}{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 hover:underline"
          >
            {t('catalog.attributionLink')}
          </a>
        </p>
      </footer>
    </div>
  );
}
