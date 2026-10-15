import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser, isRecoverySession } from '@/lib/auth/session';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reset-password'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth.reset' });
  return { title: t('title') };
}

export default async function ResetPasswordPage({ params }: PageProps<'/[locale]/reset-password'>) {
  const locale = await resolveLocale(params);
  // Only a fresh recovery-email session may use this page (signed HttpOnly
  // marker, see lib/auth/recovery.ts). The proxy enforces the same rule.
  const user = await getSessionUser();
  if (!user) redirect({ href: '/forgot-password', locale });
  if (!(await isRecoverySession(user))) redirect({ href: '/profile', locale });
  const t = await getTranslations('auth.reset');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ResetPasswordForm />
    </>
  );
}
