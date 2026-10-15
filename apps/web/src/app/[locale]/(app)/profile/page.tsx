import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getProfile } from '@bingetrail/api-client';

import { LanguageForm } from '@/components/profile/language-form';
import { Link, redirect } from '@/i18n/navigation';
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
  const ta = await getTranslations('account');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <section className="bg-surface-raised rounded-card flex flex-col gap-6 p-6">
        <dl className="flex flex-col gap-1">
          <dt className="text-ink-muted text-sm">{t('email')}</dt>
          <dd data-testid="profile-email">{user.email}</dd>
        </dl>
        <LanguageForm current={profile?.locale ?? locale} />
      </section>
      <section
        aria-labelledby="danger-heading"
        className="rounded-card flex flex-col items-start gap-3 border border-red-700 p-6"
      >
        <h2 id="danger-heading" className="text-lg font-semibold">
          {ta('dangerTitle')}
        </h2>
        <p className="text-ink-muted text-sm">{ta('dangerBody')}</p>
        <Link
          href="/profile/delete"
          className="focus-visible:ring-brand-500 rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-300 outline-none hover:bg-red-700 hover:text-white focus-visible:ring-2"
        >
          {ta('deleteLink')}
        </Link>
      </section>
    </>
  );
}
