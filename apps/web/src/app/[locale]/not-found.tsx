import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Link href="/" className="text-brand-500 underline-offset-4 hover:underline">
        {t('back')}
      </Link>
    </main>
  );
}
