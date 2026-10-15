import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SignUpForm } from '@/components/auth/signup-form';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/signup'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.signup' });
  return { title: t('title') };
}

export default async function SignUpPage({ params }: PageProps<'/[locale]/signup'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.signup');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <SignUpForm />
    </>
  );
}
