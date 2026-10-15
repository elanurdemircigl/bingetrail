import { PlaceholderPage, placeholderMetadata } from '@/components/placeholder-page';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({ params }: PageProps<'/[locale]/list'>) {
  return placeholderMetadata(await resolveLocale(params), 'list');
}

export default async function ListPage({ params }: PageProps<'/[locale]/list'>) {
  await resolveLocale(params);
  return <PlaceholderPage section="list" />;
}
