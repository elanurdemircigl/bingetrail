import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/check-email'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.checkEmail' });
  return { title: t('title') };
}

export default async function CheckEmailPage({
  params,
  searchParams,
}: PageProps<'/[locale]/check-email'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.checkEmail');
  const { reason } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p role="status">{reason === 'forgot' ? t('forgotBody') : t('signupBody')}</p>
      <Link href="/login" className="text-brand-500 text-sm underline-offset-4 hover:underline">
        {t('backToLogin')}
      </Link>
    </>
  );
}
