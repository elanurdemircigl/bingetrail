import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getContinueWatching } from '@bingetrail/api-client';
import { toProgress } from '@bingetrail/shared';

import { Poster } from '@/components/catalog/poster';
import { FormAlert } from '@/components/form-alert';
import { MarkNextButton } from '@/components/progress/mark-next-button';
import { ProgressBar } from '@/components/progress/progress-bar';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: PageProps<'/[locale]/home'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'pages.home' });
  return { title: t('title') };
}

export default async function HomePage({ params, searchParams }: PageProps<'/[locale]/home'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations();
  const tc = await getTranslations('continueWatching');
  const tp = await getTranslations('progress');
  const { passwordUpdated } = await searchParams;
  const items = await getContinueWatching(await createClient(), locale);

  return (
    <>
      {passwordUpdated === '1' && <FormAlert tone="success">{t('auth.passwordUpdated')}</FormAlert>}
      <h1 className="text-2xl font-bold">{t('pages.home.welcome')}</h1>

      <section aria-labelledby="continue-heading" className="flex flex-col gap-3">
        <h2 id="continue-heading" className="text-xl font-semibold">
          {tc('heading')}
        </h2>

        {items.length === 0 ? (
          <div className="bg-surface-raised rounded-card flex flex-col items-start gap-3 p-6">
            <p className="text-ink-muted">{tc('empty')}</p>
            <Link href="/search" className="text-brand-500 underline-offset-4 hover:underline">
              {tc('searchLink')}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const next = item.nextEpisode;
              const titleHref = `/title/${item.mediaType}/${item.tmdbId}`;
              return (
                <li
                  key={item.itemId}
                  data-testid="continue-item"
                  className="bg-surface-raised rounded-card grid grid-cols-[72px_1fr] gap-4 p-4"
                >
                  <Poster
                    path={item.posterPath}
                    title={item.title}
                    placeholder={t('catalog.noPoster')}
                    size="w185"
                  />
                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="font-semibold">
                      <Link href={titleHref} className="underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                    </h3>

                    {item.mediaType === 'movie' ? (
                      <p className="text-ink-muted text-sm">{tc('movie')}</p>
                    ) : (
                      <>
                        {item.airedCount > 0 && (
                          <ProgressBar
                            progress={toProgress(item.airedCount, item.watchedCount)}
                            label={tp('barLabel')}
                            text={tc('progress', {
                              watched: item.watchedCount,
                              aired: item.airedCount,
                            })}
                          />
                        )}
                        {next ? (
                          <>
                            <p className="text-sm" data-testid="continue-next">
                              <Link
                                href={`/title/tv/${item.tmdbId}/season/${next.seasonNumber}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {tc('next', {
                                  season: next.seasonNumber,
                                  episode: next.episodeNumber,
                                })}
                              </Link>
                              {next.name && <span className="text-ink-muted"> · {next.name}</span>}
                            </p>
                            <MarkNextButton
                              episodeId={next.id}
                              label={tc('markNextLabel', {
                                title: item.title,
                                season: next.seasonNumber,
                                episode: next.episodeNumber,
                              })}
                            />
                          </>
                        ) : (
                          <p className="text-ink-muted text-sm" data-testid="continue-next">
                            {item.airedCount > 0 && item.watchedCount >= item.airedCount
                              ? tc('upToDate')
                              : tc('noNextCached')}{' '}
                            <Link
                              href={titleHref}
                              className="text-brand-500 underline-offset-4 hover:underline"
                            >
                              {tc('seasonsLink')}
                            </Link>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
