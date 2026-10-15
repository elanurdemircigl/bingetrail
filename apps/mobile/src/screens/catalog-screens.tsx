import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { CatalogError, ProgressError } from '@bingetrail/api-client';
import {
  airedIdsUpTo,
  isAired,
  mediaTypeSchema,
  progressOf,
  shouldSuggestCompletion,
  utcToday,
  type CatalogErrorCode,
} from '@bingetrail/shared';

import {
  Alert,
  Button,
  Heading,
  Loading,
  Muted,
  Poster,
  ProgressBar,
  Screen,
  TextField,
  Title,
} from '@/components/ui';
import { WatchlistControls } from '@/components/watchlist-controls';
import { currentLocale } from '@/lib/i18n';
import {
  useSearch,
  useSeason,
  useSetEpisodesWatched,
  useTitle,
  useTitleProgress,
  useUpdateStatus,
  useWatchedEpisodes,
  useWatchlistItem,
} from '@/lib/queries';

const errorCode = (error: unknown): CatalogErrorCode =>
  error instanceof CatalogError ? error.code : 'internal';

function CatalogErrorView({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return <Alert>{t(`catalog.errors.${errorCode(error)}`)}</Alert>;
}

/** Same rules as the web route params: plain digits only. */
const toId = (value: string | undefined, min = 1) =>
  value && /^\d{1,9}$/.test(value) && Number(value) >= min ? Number(value) : null;

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

// ---------------------------------------------------------------------------
export function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = currentLocale();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Debounced like the web search box (350 ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim().slice(0, 100));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useSearch(query, page, locale);
  const data = search.data;

  return (
    <Screen>
      <TextField
        label={t('catalog.search.label')}
        placeholder={t('catalog.search.placeholder')}
        value={text}
        onChangeText={setText}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => setQuery(text.trim().slice(0, 100))}
      />
      {!query && <Muted>{t('catalog.search.hint')}</Muted>}
      {search.isError && <CatalogErrorView error={search.error} />}
      {search.isFetching && !data && <Loading />}
      {data && query && (
        <>
          <Text accessibilityLiveRegion="polite" className="text-sm text-ink-muted">
            {data.results.length === 0
              ? t('catalog.search.noResults', { query })
              : t('catalog.search.resultCount', { count: data.totalResults })}
          </Text>
          {data.results.map((result) => (
            <Pressable
              key={`${result.mediaType}-${result.tmdbId}`}
              accessibilityRole="link"
              accessibilityLabel={`${result.title}, ${t(`catalog.mediaType.${result.mediaType}`)}`}
              onPress={() =>
                router.push({
                  pathname: '/title/[mediaType]/[tmdbId]',
                  params: { mediaType: result.mediaType, tmdbId: String(result.tmdbId) },
                })
              }
              className="flex-row gap-3 rounded-lg bg-surface-raised p-3"
            >
              <Poster path={result.posterPath} title={result.title} width={60} />
              <View className="flex-1 gap-1">
                <Text className="font-semibold text-ink">{result.title}</Text>
                <Muted>
                  {t(`catalog.mediaType.${result.mediaType}`)}
                  {result.releaseDate ? ` · ${result.releaseDate.slice(0, 4)}` : ''}
                </Muted>
              </View>
            </Pressable>
          ))}
          {data.totalPages > 1 && (
            <View className="flex-row items-center justify-between">
              <Button
                tone="secondary"
                label={t('catalog.search.previous')}
                disabled={page <= 1}
                onPress={() => setPage(page - 1)}
              />
              <Muted>
                {t('catalog.search.pageOf', { page, total: Math.min(data.totalPages, 20) })}
              </Muted>
              <Button
                tone="secondary"
                label={t('catalog.search.next')}
                disabled={page >= Math.min(data.totalPages, 20)}
                onPress={() => setPage(page + 1)}
              />
            </View>
          )}
        </>
      )}
      <Muted>{t('catalog.attribution')}</Muted>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
export function TitleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const locale = currentLocale();
  const params = useLocalSearchParams<{ mediaType: string; tmdbId: string }>();
  const mediaType = mediaTypeSchema.safeParse(params.mediaType);
  const tmdbId = toId(params.tmdbId);
  const valid = mediaType.success && tmdbId !== null;

  const title = useTitle(mediaType.data ?? 'movie', tmdbId ?? 1, locale);
  const detail = valid ? title.data : undefined;
  const entry = useWatchlistItem(detail?.id, locale);
  const progress = useTitleProgress(detail?.mediaType === 'tv' ? detail.id : undefined);
  const updateStatus = useUpdateStatus(detail?.id ?? 0);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useLayoutEffect(() => {
    if (detail) navigation.setOptions({ title: detail.title });
  }, [navigation, detail]);

  if (!valid)
    return (
      <Screen>
        <Alert>{t('catalog.errors.not_found')}</Alert>
      </Screen>
    );
  if (title.isPending) return <Loading />;
  if (!detail)
    return (
      <Screen>
        <CatalogErrorView error={title.error} />
      </Screen>
    );

  const item = entry.data ?? null;
  const summary = progress.data;
  const suggest =
    !promptDismissed &&
    item !== null &&
    summary !== undefined &&
    shouldSuggestCompletion({ status: item.status, ...summary });

  return (
    <Screen>
      <View className="flex-row gap-4">
        <Poster path={detail.posterPath} title={detail.title} width={120} />
        <View className="flex-1 gap-1">
          <Muted>{t(`catalog.mediaType.${detail.mediaType}`)}</Muted>
          <Title>{detail.title}</Title>
          {detail.originalTitle !== detail.title && (
            <Muted>{t('catalog.originalTitle', { title: detail.originalTitle })}</Muted>
          )}
          <Muted>
            {detail.releaseDate ? formatDate(detail.releaseDate, locale) : t('catalog.dateUnknown')}
          </Muted>
        </View>
      </View>
      <Text className="leading-6 text-ink">{detail.overview ?? t('catalog.overviewMissing')}</Text>

      {summary && summary.airedCount > 0 && (
        <ProgressBar
          testID="title-progress"
          aired={summary.airedCount}
          watched={summary.watchedCount}
          text={t('progress.bar', { watched: summary.watchedCount, aired: summary.airedCount })}
        />
      )}
      {suggest && item && (
        <View className="gap-3 rounded-lg border border-emerald-500 bg-emerald-500/10 p-4">
          <Text className="text-ink">{t('progress.completeSuggestion')}</Text>
          <Button
            label={t('progress.completeYes')}
            pending={updateStatus.isPending}
            onPress={() => updateStatus.mutate({ itemId: item.id, status: 'completed' })}
          />
          <Button
            tone="secondary"
            label={t('progress.completeDismiss')}
            onPress={() => setPromptDismissed(true)}
          />
        </View>
      )}

      {entry.isPending ? (
        <Loading />
      ) : (
        <WatchlistControls titleId={detail.id} title={detail.title} item={item} />
      )}

      {detail.mediaType === 'tv' && detail.seasons.length > 0 && (
        <View className="gap-2">
          <Heading>{t('catalog.seasons')}</Heading>
          {detail.seasons.map((season) => (
            <Pressable
              key={season.seasonNumber}
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: '/season/[tmdbId]/[seasonNumber]',
                  params: {
                    tmdbId: String(detail.tmdbId),
                    seasonNumber: String(season.seasonNumber),
                  },
                })
              }
              className="flex-row justify-between rounded-lg bg-surface-raised px-4 py-3"
            >
              <Text className="font-medium text-ink">{season.name}</Text>
              {season.episodeCount !== null && (
                <Muted>{t('catalog.episodeCount', { count: season.episodeCount })}</Muted>
              )}
            </Pressable>
          ))}
        </View>
      )}
      <Muted>{t('catalog.attribution')}</Muted>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
export function SeasonScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const locale = currentLocale();
  const params = useLocalSearchParams<{ tmdbId: string; seasonNumber: string }>();
  const tmdbId = toId(params.tmdbId);
  const seasonNumber = toId(params.seasonNumber, 0);
  const valid = tmdbId !== null && seasonNumber !== null && seasonNumber <= 500;

  const season = useSeason(tmdbId ?? 1, seasonNumber ?? 0, locale);
  const detail = valid ? season.data : undefined;
  const watched = useWatchedEpisodes(detail?.titleId);
  const setWatched = useSetEpisodesWatched(detail?.titleId ?? 0);
  const today = utcToday();

  useLayoutEffect(() => {
    if (detail) navigation.setOptions({ title: detail.name });
  }, [navigation, detail]);

  if (!valid)
    return (
      <Screen>
        <Alert>{t('catalog.errors.not_found')}</Alert>
      </Screen>
    );
  if (season.isPending) return <Loading />;
  if (!detail)
    return (
      <Screen>
        <CatalogErrorView error={season.error} />
      </Screen>
    );

  const watchedIds = watched.data ?? new Set<number>();
  const episodes = detail.episodes;
  const progress = progressOf(episodes, watchedIds, today);
  const mark = (ids: number[], value: boolean) => {
    const changed = ids.filter((id) => watchedIds.has(id) !== value);
    if (changed.length > 0) setWatched.mutate({ ids: changed, watched: value });
  };
  const progressError = setWatched.error
    ? setWatched.error instanceof ProgressError
      ? setWatched.error.code
      : 'unexpected'
    : null;

  return (
    <Screen>
      <Title>{detail.name}</Title>
      {progressError && <Alert>{t(`progress.errors.${progressError}`)}</Alert>}
      {progress.aired > 0 && (
        <ProgressBar
          testID="season-progress"
          aired={progress.aired}
          watched={progress.watched}
          text={t('progress.seasonBar', { watched: progress.watched, aired: progress.aired })}
        />
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button
          tone="secondary"
          label={t('progress.markSeason')}
          disabled={progress.watched === progress.aired}
          onPress={() =>
            mark(
              episodes.filter((e) => isAired(e.airDate, today)).map((e) => e.id),
              true,
            )
          }
        />
        <Button
          tone="secondary"
          label={t('progress.unmarkSeason')}
          disabled={progress.watched === 0}
          onPress={() =>
            mark(
              episodes.map((e) => e.id),
              false,
            )
          }
        />
      </View>

      {episodes.map((episode) => {
        const aired = isAired(episode.airDate, today);
        const isWatched = watchedIds.has(episode.id);
        return (
          <View
            key={episode.id}
            testID="episode"
            className="gap-2 rounded-lg bg-surface-raised px-4 py-3"
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={t('progress.watchedLabel', { number: episode.episodeNumber })}
              accessibilityState={{ checked: isWatched, disabled: !aired }}
              disabled={!aired}
              onPress={() => mark([episode.id], !isWatched)}
              className="flex-row items-center gap-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded border ${isWatched ? 'border-brand-600 bg-brand-600' : 'border-ink-muted'} ${aired ? '' : 'opacity-40'}`}
              >
                {isWatched && <Text className="font-bold text-white">✓</Text>}
              </View>
              <View className="flex-1">
                <Text className="text-ink">
                  <Text className="text-ink-muted">{episode.episodeNumber}. </Text>
                  {episode.name}
                </Text>
                <Muted>
                  {episode.airDate ? formatDate(episode.airDate, locale) : t('catalog.dateUnknown')}
                  {episode.runtime !== null
                    ? ` · ${t('catalog.runtime', { minutes: episode.runtime })}`
                    : ''}
                  {aired ? '' : ` · ${t('progress.notAired')}`}
                </Muted>
              </View>
            </Pressable>
            {aired && episode.episodeNumber > 1 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('progress.markUpToLabel', { number: episode.episodeNumber })}
                onPress={() => mark(airedIdsUpTo(episodes, episode.episodeNumber, today), true)}
                className="min-h-9 self-start justify-center"
              >
                <Text className="text-sm text-brand-500 underline">{t('progress.markUpTo')}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
