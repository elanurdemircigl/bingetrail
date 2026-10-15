import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import {
  CatalogError,
  getSeasonDetail,
  getTitleDetail,
  getWatchedEpisodeIds,
} from '@bingetrail/api-client';
import { utcToday } from '@bingetrail/shared';

import { CatalogErrorNotice } from '@/components/catalog/catalog-error';
import { EpisodeList } from '@/components/progress/episode-list';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { dateFromIso, seasonParamsSchema } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

type Params = PageProps<'/[locale]/title/[mediaType]/[tmdbId]/season/[seasonNumber]'>['params'];

const loadSeason = cache(async (tmdbId: number, seasonNumber: number, locale: Locale) => {
  const client = await createClient();
  try {
    // The show is cached by the season call anyway; both stay within one request.
    const show = await getTitleDetail(client, { mediaType: 'tv', tmdbId, locale });
    const season = await getSeasonDetail(client, { tmdbId, seasonNumber, locale });
    return { show, season };
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    if (error.code === 'not_found' || error.code === 'invalid_request') notFound();
    return { error: error.code };
  }
});

async function resolve(params: Params) {
  const locale = await resolveLocale(params);
  const parsed = seasonParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tmdbId, seasonNumber } = parsed.data;
  return { tmdbId, result: await loadSeason(tmdbId, seasonNumber, locale) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { result } = await resolve(params);
  return result.season ? { title: `${result.season.name} · ${result.show.title}` } : {};
}

export default async function SeasonPage({ params }: { params: Params }) {
  const { tmdbId, result } = await resolve(params);
  if (!result.season) return <CatalogErrorNotice code={result.error} />;

  const { show, season } = result;
  const watchedIds = await getWatchedEpisodeIds(await createClient(), season.titleId);
  const t = await getTranslations('catalog');
  const format = await getFormatter();

  return (
    <article className="flex flex-col gap-4">
      <Link href={`/title/tv/${tmdbId}`} className="text-brand-500 text-sm hover:underline">
        ← {t('backToTitle')}
      </Link>
      <header>
        <p className="text-ink-muted text-sm">{show.title}</p>
        <h1 className="text-3xl font-bold">{season.name}</h1>
      </header>

      <section aria-labelledby="episodes-heading" className="flex flex-col gap-2">
        <h2 id="episodes-heading" className="text-xl font-semibold">
          {t('episodes')}
        </h2>
        <EpisodeList
          episodes={season.episodes.map((episode) => ({
            id: episode.id,
            episodeNumber: episode.episodeNumber,
            name: episode.name,
            airDate: episode.airDate,
            meta: [
              episode.airDate
                ? format.dateTime(dateFromIso(episode.airDate), {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  })
                : t('dateUnknown'),
              episode.runtime !== null ? t('runtime', { minutes: episode.runtime }) : null,
            ]
              .filter(Boolean)
              .join(' · '),
          }))}
          watchedIds={[...watchedIds]}
          today={utcToday()}
        />
      </section>
    </article>
  );
}
