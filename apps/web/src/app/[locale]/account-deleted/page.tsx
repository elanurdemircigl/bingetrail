import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account-deleted'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'account.deleted' });
  return { title: t('title') };
}

/** Public confirmation page shown after the account and its session are gone. */
export default async function AccountDeletedPage({
  params,
}: PageProps<'/[locale]/account-deleted'>) {
  await resolveLocale(params);
  const t = await getTranslations('account.deleted');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p role="status">{t('body')}</p>
      <Link href="/" className="text-brand-500 underline-offset-4 hover:underline">
        {t('home')}
      </Link>
    </main>
  );
}
