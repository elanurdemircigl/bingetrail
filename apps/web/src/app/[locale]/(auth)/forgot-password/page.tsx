import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/forgot-password'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.forgot' });
  return { title: t('title') };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<'/[locale]/forgot-password'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.forgot');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ForgotPasswordForm />
    </>
  );
}
