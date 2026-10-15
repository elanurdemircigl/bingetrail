import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

type Section = 'search' | 'list' | 'calendar';

/** Shell page for sections whose features arrive in later phases. */
export async function PlaceholderPage({ section }: { section: Section }) {
  const t = await getTranslations(`pages.${section}`);

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-ink-muted">{t('body')}</p>
    </>
  );
}

export async function placeholderMetadata(locale: Locale, section: Section) {
  const t = await getTranslations({ locale, namespace: `pages.${section}` });
  return { title: t('title') };
}
