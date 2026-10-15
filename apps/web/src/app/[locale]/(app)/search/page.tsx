import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getFormatter, getTranslations } from 'next-intl/server';

import { CatalogError, searchCatalog } from '@bingetrail/api-client';
import type { CatalogErrorCode, SearchResponse } from '@bingetrail/shared';

import { CatalogErrorNotice } from '@/components/catalog/catalog-error';
import { Poster } from '@/components/catalog/poster';
import { SearchBox } from '@/components/catalog/search-box';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { dateFromIso, parseSearchParams, SEARCH_MAX_PAGE } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'pages.search' });
  return { title: t('title') };
}

/** Data first, rendering outside the try/catch (render errors must not be swallowed). */
async function runSearch(
  query: string,
  page: number,
  locale: Locale,
): Promise<{ data: SearchResponse } | { error: CatalogErrorCode }> {
  try {
    return { data: await searchCatalog(await createClient(), { query, page, locale }) };
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    return { error: error.code };
  }
}

export default async function SearchPage({ params, searchParams }: PageProps<'/[locale]/search'>) {
  const locale = await resolveLocale(params);
  const { query, page } = parseSearchParams(await searchParams);
  const t = await getTranslations('catalog');
  const tp = await getTranslations('pages.search');
  const format = await getFormatter();
  const outcome = query ? await runSearch(query, page, locale) : null;

  return (
    <>
      <h1 className="text-2xl font-bold">{tp('title')}</h1>
      <SearchBox initialQuery={query} />

      {!outcome && <p className="text-ink-muted">{t('search.hint')}</p>}
      {outcome && 'error' in outcome && <CatalogErrorNotice code={outcome.error} />}
      {outcome && 'data' in outcome && outcome.data.results.length === 0 && (
        <p role="status">{t('search.noResults', { query })}</p>
      )}
      {outcome && 'data' in outcome && outcome.data.results.length > 0 && (
        <section aria-labelledby="results-heading" className="flex flex-col gap-4">
          <h2 id="results-heading" className="text-ink-muted text-sm">
            {t('search.resultCount', { count: outcome.data.totalResults })}
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {outcome.data.results.map((item) => (
              <li key={`${item.mediaType}-${item.tmdbId}`}>
                <Link
                  href={`/title/${item.mediaType}/${item.tmdbId}`}
                  className="focus-visible:ring-brand-500 group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2"
                >
                  <Poster
                    path={item.posterPath}
                    title={item.title}
                    placeholder={t('noPoster')}
                    size="w185"
                  />
                  <span className="font-semibold group-hover:underline">{item.title}</span>
                  <span className="text-ink-muted text-xs">
                    {t(`mediaType.${item.mediaType}`)}
                    {item.releaseDate &&
                      ` · ${format.dateTime(dateFromIso(item.releaseDate), { year: 'numeric', timeZone: 'UTC' })}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            query={query}
            page={page}
            lastPage={Math.min(outcome.data.totalPages, SEARCH_MAX_PAGE)}
            labels={{
              previous: t('search.previous'),
              next: t('search.next'),
              status: t('search.pageOf', {
                page,
                total: Math.min(outcome.data.totalPages, SEARCH_MAX_PAGE),
              }),
            }}
          />
        </section>
      )}
    </>
  );
}

function Pagination({
  query,
  page,
  lastPage,
  labels,
}: {
  query: string;
  page: number;
  lastPage: number;
  labels: { previous: string; next: string; status: string };
}) {
  if (lastPage <= 1) return null;
  return (
    <nav aria-label={labels.status} className="flex items-center gap-4 text-sm">
      {page > 1 && (
        <Link
          href={{ pathname: '/search', query: { q: query, page: page - 1 } }}
          className="text-brand-500 hover:underline"
        >
          {labels.previous}
        </Link>
      )}
      <span>{labels.status}</span>
      {page < lastPage && (
        <Link
          href={{ pathname: '/search', query: { q: query, page: page + 1 } }}
          className="text-brand-500 hover:underline"
        >
          {labels.next}
        </Link>
      )}
    </nav>
  );
}
