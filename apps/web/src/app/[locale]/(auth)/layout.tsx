import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/language-switcher';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';

export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await resolveLocale(params);
  const t = await getTranslations('app');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-brand-500 text-xl font-bold">
          {t('name')}
        </Link>
        <LanguageSwitcher />
      </header>
      <section className="bg-surface-raised rounded-card flex flex-col gap-5 p-6">
        {children}
      </section>
    </main>
  );
}
