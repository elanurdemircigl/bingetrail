import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getWatchlist, getWatchlistCounts } from '@bingetrail/api-client';
import {
  parseWatchlistFilters,
  WATCH_STATUSES,
  WATCHLIST_SORTS,
  type WatchlistFilters,
} from '@bingetrail/shared';

import { Poster } from '@/components/catalog/poster';
import { ListItemActions } from '@/components/watchlist/list-item-actions';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/page';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: PageProps<'/[locale]/list'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'pages.list' });
  return { title: t('title') };
}

/** Filter links keep the sort; the URL is the single source of filter state. */
function listHref(filters: WatchlistFilters) {
  const query: Record<string, string> = {};
  if (filters.status) query.status = filters.status;
  if (filters.sort !== 'recent') query.sort = filters.sort;
  return { pathname: '/list' as const, query };
}

export default async function ListPage({ params, searchParams }: PageProps<'/[locale]/list'>) {
  const locale = await resolveLocale(params);
  const filters = parseWatchlistFilters(await searchParams);
  const supabase = await createClient();
  const [items, counts] = await Promise.all([
    getWatchlist(supabase, { ...filters, locale }),
    getWatchlistCounts(supabase),
  ]);
  const total = WATCH_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  const t = await getTranslations('list');
  const tw = await getTranslations('watchlist');
  const tp = await getTranslations('pages.list');
  const tc = await getTranslations('catalog');

  const tabs = [
    { status: null, label: t('all'), count: total },
    ...WATCH_STATUSES.map((status) => ({
      status,
      label: tw(`status.${status}`),
      count: counts[status],
    })),
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">{tp('title')}</h1>

      <nav aria-label={t('filterLabel')}>
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const current = tab.status === filters.status;
            return (
              <li key={tab.status ?? 'all'}>
                <Link
                  href={listHref({ status: tab.status, sort: filters.sort })}
                  aria-current={current ? 'page' : undefined}
                  data-testid={`list-tab-${tab.status ?? 'all'}`}
                  className={`focus-visible:ring-brand-500 inline-flex gap-1.5 rounded-full px-3 py-1.5 text-sm outline-none focus-visible:ring-2 ${
                    current ? 'bg-brand-600 text-white' : 'bg-surface-raised hover:bg-surface-muted'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span aria-hidden="true">({tab.count})</span>
                  <span className="sr-only">{t('count', { count: tab.count })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* A plain GET form: works before hydration and keeps filters in the URL. */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="list-sort" className="text-sm font-medium">
            {t('sortLabel')}
          </label>
          <select
            id="list-sort"
            name="sort"
            defaultValue={filters.sort}
            className="bg-surface border-surface-muted focus-visible:ring-brand-500 rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
          >
            {WATCHLIST_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`sort.${sort}`)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-surface-raised hover:bg-surface-muted focus-visible:ring-brand-500 rounded-lg px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2"
        >
          {t('apply')}
        </button>
      </form>

      <p className="text-ink-muted text-sm" role="status">
        {t('count', { count: items.length })}
      </p>

      {items.length === 0 ? (
        <div className="bg-surface-raised rounded-card flex flex-col items-start gap-3 p-6">
          <p>{total === 0 ? t('empty') : t('emptyFiltered')}</p>
          {total === 0 && (
            <Link href="/search" className="text-brand-500 underline-offset-4 hover:underline">
              {t('searchLink')}
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="watchlist-items">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid="watchlist-item"
              className="bg-surface-raised rounded-card grid grid-cols-[72px_1fr] gap-4 p-4 sm:grid-cols-[92px_1fr_auto]"
            >
              <div>
                <Poster
                  path={item.title.posterPath}
                  title={item.title.title}
                  placeholder={tc('noPoster')}
                  size="w185"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`/title/${item.title.mediaType}/${item.title.tmdbId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {item.title.title}
                  </Link>
                </h2>
                <p className="text-ink-muted text-sm">
                  {tc(`mediaType.${item.title.mediaType}`)} · {tw(`status.${item.status}`)}
                  {item.rating !== null && ` · ${t('ratingShort', { rating: item.rating })}`}
                </p>
                {/* Notes are user text: rendered as text, never as HTML. */}
                {item.notes && (
                  <p
                    data-testid="watchlist-notes"
                    className="line-clamp-3 text-sm break-words whitespace-pre-wrap"
                  >
                    {item.notes}
                  </p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <ListItemActions itemId={item.id} title={item.title.title} status={item.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
