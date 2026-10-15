import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getProfile } from '@bingetrail/api-client';

import { LanguageForm } from '@/components/profile/language-form';
import { SignOutButton } from '@/components/sign-out-button';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/profile'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title') };
}

export default async function ProfilePage({ params }: PageProps<'/[locale]/profile'>) {
  const locale = await resolveLocale(params);
  const user = await getSessionUser();
  if (!user) return redirect({ href: '/login', locale });

  const profile = await getProfile(await createClient(), user.id);
  const t = await getTranslations('profile');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <section className="bg-surface-raised rounded-card flex flex-col gap-6 p-6">
        <dl className="flex flex-col gap-1">
          <dt className="text-ink-muted text-sm">{t('email')}</dt>
          <dd data-testid="profile-email">{user.email}</dd>
        </dl>
        <LanguageForm current={profile?.locale ?? locale} />
        <div>
          <SignOutButton label={t('signOut')} />
        </div>
      </section>
    </>
  );
}
