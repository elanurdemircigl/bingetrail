import { PlaceholderPage, placeholderMetadata } from '@/components/placeholder-page';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({ params }: PageProps<'/[locale]/search'>) {
  return placeholderMetadata(await resolveLocale(params), 'search');
}

export default async function SearchPage({ params }: PageProps<'/[locale]/search'>) {
  await resolveLocale(params);
  return <PlaceholderPage section="search" />;
}
