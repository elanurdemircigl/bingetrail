import { PlaceholderPage, placeholderMetadata } from '@/components/placeholder-page';
import { resolveLocale } from '@/i18n/page';

export async function generateMetadata({ params }: PageProps<'/[locale]/calendar'>) {
  return placeholderMetadata(await resolveLocale(params), 'calendar');
}

export default async function CalendarPage({ params }: PageProps<'/[locale]/calendar'>) {
  await resolveLocale(params);
  return <PlaceholderPage section="calendar" />;
}
