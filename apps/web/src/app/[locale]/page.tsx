import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/language-switcher';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';

const primary =
  'bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 font-semibold text-white transition';
const secondary = 'border-surface-muted hover:bg-surface-muted rounded-lg border px-4 py-2';

export default async function LandingPage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  const t = await getTranslations();
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="text-brand-500 text-4xl font-bold">{t('app.name')}</h1>
      <p className="text-lg">{t('app.tagline')}</p>
      <p className="text-ink-muted">{t('home.comingSoon')}</p>
      <div className="flex flex-wrap gap-3">
        {user ? (
          <Link href="/home" className={primary}>
            {t('landing.openApp')}
          </Link>
        ) : (
          <>
            <Link href="/login" className={primary}>
              {t('landing.signIn')}
            </Link>
            <Link href="/signup" className={secondary}>
              {t('landing.signUp')}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
