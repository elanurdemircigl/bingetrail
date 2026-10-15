import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reset-password'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.reset' });
  return { title: t('title') };
}

export default async function ResetPasswordPage({ params }: PageProps<'/[locale]/reset-password'>) {
  const locale = await resolveLocale(params);
  // Reached through the recovery email (which signs the user in); the proxy
  // also enforces this, the check here is defence in depth.
  if (!(await getSessionUser())) redirect({ href: '/forgot-password', locale });
  const t = await getTranslations('auth.reset');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ResetPasswordForm />
    </>
  );
}
