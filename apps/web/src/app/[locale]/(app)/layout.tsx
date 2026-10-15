import { getTranslations } from 'next-intl/server';

import { AppNav } from '@/components/app-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { Link, redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';

/** Shell for signed-in pages. Re-checks the session even though the proxy already did. */
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  if (!(await getSessionUser())) redirect({ href: '/login', locale });
  const t = await getTranslations();

  return (
    <div className="min-h-screen">
      <header className="border-surface-muted border-b">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/home" className="text-brand-500 text-lg font-bold">
            {t('app.name')}
          </Link>
          <AppNav />
          <SignOutButton label={t('nav.signOut')} />
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8">{children}</main>
    </div>
  );
}
