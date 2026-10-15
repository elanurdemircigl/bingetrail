import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/components/auth/login-form';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.login' });
  return { title: t('title') };
}

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.login');
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <LoginForm
        next={typeof next === 'string' ? next : undefined}
        initialError={error === 'linkInvalid' ? 'linkInvalid' : undefined}
      />
    </>
  );
}
