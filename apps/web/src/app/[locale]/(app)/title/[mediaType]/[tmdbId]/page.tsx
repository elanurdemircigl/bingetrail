import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { CatalogError, getTitleDetail, getWatchlistItemForTitle } from '@bingetrail/api-client';
import type { MediaType } from '@bingetrail/shared';

import { CatalogErrorNotice } from '@/components/catalog/catalog-error';
import { Poster } from '@/components/catalog/poster';
import { WatchlistControl } from '@/components/watchlist/watchlist-control';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { dateFromIso, statusKey, titleParamsSchema } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

type Params = PageProps<'/[locale]/title/[mediaType]/[tmdbId]'>['params'];

/** One function call per request even though metadata and page both need it. */
const loadTitle = cache(async (mediaType: MediaType, tmdbId: number, locale: Locale) => {
  try {
    return { detail: await getTitleDetail(await createClient(), { mediaType, tmdbId, locale }) };
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    if (error.code === 'not_found' || error.code === 'invalid_request') notFound();
    return { error: error.code };
  }
});

async function resolve(params: Params) {
  const locale = await resolveLocale(params);
  const parsed = titleParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return {
    locale,
    ...parsed.data,
    result: await loadTitle(parsed.data.mediaType, parsed.data.tmdbId, locale),
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { result } = await resolve(params);
  return result.detail ? { title: result.detail.title } : {};
}

export default async function TitlePage({ params }: { params: Params }) {
  const { result, locale } = await resolve(params);
  if (!result.detail) return <CatalogErrorNotice code={result.error} />;

  const title = result.detail;
  const entry = await getWatchlistItemForTitle(await createClient(), title.id, locale);
  const t = await getTranslations('catalog');
  const format = await getFormatter();
  const status = statusKey(title.status);
  const date = (iso: string) =>
    format.dateTime(dateFromIso(iso), { dateStyle: 'long', timeZone: 'UTC' });

  return (
    <article className="grid gap-6 sm:grid-cols-[200px_1fr]">
      <div className="max-w-[200px]">
        <Poster path={title.posterPath} title={title.title} placeholder={t('noPoster')} priority />
      </div>
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <p className="text-ink-muted text-sm">{t(`mediaType.${title.mediaType}`)}</p>
          <h1 className="text-3xl font-bold">{title.title}</h1>
          {title.originalTitle !== title.title && (
            <p className="text-ink-muted">{t('originalTitle', { title: title.originalTitle })}</p>
          )}
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">
            {title.mediaType === 'tv' ? t('firstAirDate') : t('releaseDate')}
          </dt>
          <dd>{title.releaseDate ? date(title.releaseDate) : t('dateUnknown')}</dd>
          {title.status && (
            <>
              <dt className="text-ink-muted">{t('status')}</dt>
              <dd>{status ? t(`statusLabels.${status}`) : title.status}</dd>
            </>
          )}
        </dl>

        <p className="leading-relaxed">{title.overview ?? t('overviewMissing')}</p>

        <WatchlistControl
          // Remount after add/remove so local form state starts from the server copy.
          key={entry?.id ?? 'none'}
          titleId={title.id}
          title={title.title}
          entry={
            entry
              ? { id: entry.id, status: entry.status, rating: entry.rating, notes: entry.notes }
              : null
          }
        />

        {title.mediaType === 'tv' && title.seasons.length > 0 && (
          <section aria-labelledby="seasons-heading" className="flex flex-col gap-2">
            <h2 id="seasons-heading" className="text-xl font-semibold">
              {t('seasons')}
            </h2>
            <ul className="flex flex-col gap-2">
              {title.seasons.map((season) => (
                <li key={season.seasonNumber}>
                  <Link
                    href={`/title/tv/${title.tmdbId}/season/${season.seasonNumber}`}
                    className="bg-surface-raised hover:bg-surface-muted focus-visible:ring-brand-500 flex flex-wrap justify-between gap-2 rounded-lg px-4 py-3 outline-none focus-visible:ring-2"
                  >
                    <span className="font-medium">{season.name}</span>
                    <span className="text-ink-muted text-sm">
                      {season.episodeCount !== null &&
                        t('episodeCount', { count: season.episodeCount })}
                      {season.airDate &&
                        ` · ${format.dateTime(dateFromIso(season.airDate), { year: 'numeric', timeZone: 'UTC' })}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
