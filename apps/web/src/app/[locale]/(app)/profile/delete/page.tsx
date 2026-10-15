import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DeleteAccountForm } from '@/components/account/delete-account-form';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { getSessionUser } from '@/lib/auth/session';

const DELETED_ITEMS = ['account', 'profile', 'list', 'progress', 'avatar'] as const;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/profile/delete'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'account.delete' });
  return { title: t('title') };
}

export default async function DeleteAccountPage({ params }: PageProps<'/[locale]/profile/delete'>) {
  const locale = await resolveLocale(params);
  const user = await getSessionUser();
  if (!user) return redirect({ href: '/login', locale });

  const t = await getTranslations('account.delete');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <section className="bg-surface-raised rounded-card flex flex-col gap-6 p-6">
        <div
          role="note"
          className="flex flex-col gap-3 rounded-lg border border-red-700 bg-red-700/10 p-4"
        >
          <p className="font-semibold" data-testid="delete-irreversible">
            {t('irreversible')}
          </p>
          <p>{t('willDelete')}</p>
          <ul className="list-disc pl-6">
            {DELETED_ITEMS.map((item) => (
              <li key={item}>{t(`items.${item}`)}</li>
            ))}
          </ul>
          <p className="text-ink-muted text-sm">{t('keeps')}</p>
        </div>
        <DeleteAccountForm />
      </section>
    </>
  );
}
