import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { FormAlert } from '@/components/form-alert';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({ params }: PageProps<'/[locale]/home'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'pages.home' });
  return { title: t('title') };
}

export default async function HomePage({ params, searchParams }: PageProps<'/[locale]/home'>) {
  await resolveLocale(params);
  const t = await getTranslations();
  const { passwordUpdated } = await searchParams;

  return (
    <>
      {passwordUpdated === '1' && <FormAlert tone="success">{t('auth.passwordUpdated')}</FormAlert>}
      <h1 className="text-2xl font-bold">{t('pages.home.welcome')}</h1>
      <p className="text-ink-muted">{t('pages.home.body')}</p>
    </>
  );
}
