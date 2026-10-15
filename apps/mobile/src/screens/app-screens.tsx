import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';

import { AccountError, deleteAccount, updateProfileLocale } from '@bingetrail/api-client';
import { LOCALES, type Locale } from '@bingetrail/i18n';
import {
  deleteAccountFormSchema,
  WATCH_STATUSES,
  WATCHLIST_SORTS,
  type WatchlistSort,
  type WatchStatus,
} from '@bingetrail/shared';

import {
  Alert,
  Button,
  Chip,
  Heading,
  Loading,
  Muted,
  Poster,
  ProgressBar,
  Screen,
  Title,
} from '@/components/ui';
import { SyncStatus } from '@/components/sync-banner';
import { StatusChips } from '@/components/watchlist-controls';
import { signOut } from '@/lib/auth/actions';
import { useSession } from '@/lib/auth/session';
import { currentLocale, setAppLocale } from '@/lib/i18n';
import {
  useContinueWatching,
  useSetEpisodesWatched,
  useUpdateStatus,
  useWatchlist,
  useWatchlistCounts,
} from '@/lib/queries';
import { supabase } from '@/lib/supabase/client';

import { Field, useFieldError } from './auth-screens';

const openTitle = (router: ReturnType<typeof useRouter>, mediaType: string, tmdbId: number) =>
  router.push({
    pathname: '/title/[mediaType]/[tmdbId]',
    params: { mediaType, tmdbId: String(tmdbId) },
  });

// ---------------------------------------------------------------------------
function MarkNext({
  titleId,
  episodeId,
  label,
}: {
  titleId: number;
  episodeId: number;
  label: string;
}) {
  const { t } = useTranslation();
  const mark = useSetEpisodesWatched(titleId);
  return (
    <Button
      label={t('continueWatching.markNext')}
      accessibilityLabel={label}
      pendingLabel={t('progress.saving')}
      pending={mark.isPending}
      onPress={() => mark.mutate({ ids: [episodeId], watched: true })}
    />
  );
}

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const items = useContinueWatching(currentLocale());

  return (
    <Screen>
      <Title>{t('pages.home.welcome')}</Title>
      <Heading>{t('continueWatching.heading')}</Heading>
      {items.isPending && <Loading />}
      {items.isError && <Alert>{t('progress.errors.unexpected')}</Alert>}
      {items.data?.length === 0 && (
        <View className="gap-3 rounded-card bg-surface-raised p-4">
          <Muted>{t('continueWatching.empty')}</Muted>
          <Button
            tone="secondary"
            label={t('continueWatching.searchLink')}
            onPress={() => router.push('/search')}
          />
        </View>
      )}
      {items.data?.map((item) => {
        const next = item.nextEpisode;
        return (
          <View
            key={item.itemId}
            testID="continue-item"
            className="flex-row gap-3 rounded-card bg-surface-raised p-3"
          >
            <Poster path={item.posterPath} title={item.title} width={72} />
            <View className="flex-1 gap-2">
              <Pressable
                accessibilityRole="link"
                onPress={() => openTitle(router, item.mediaType, item.tmdbId)}
              >
                <Text className="font-semibold text-ink">{item.title}</Text>
              </Pressable>
              {item.mediaType === 'movie' ? (
                <Muted>{t('continueWatching.movie')}</Muted>
              ) : (
                <>
                  {item.airedCount > 0 && (
                    <ProgressBar
                      aired={item.airedCount}
                      watched={item.watchedCount}
                      text={t('continueWatching.progress', {
                        watched: item.watchedCount,
                        aired: item.airedCount,
                      })}
                    />
                  )}
                  {next ? (
                    <>
                      <Text testID="continue-next" className="text-sm text-ink">
                        {t('continueWatching.next', {
                          season: next.seasonNumber,
                          episode: next.episodeNumber,
                        })}
                        {next.name ? ` · ${next.name}` : ''}
                      </Text>
                      <MarkNext
                        titleId={item.titleId}
                        episodeId={next.id}
                        label={t('continueWatching.markNextLabel', {
                          title: item.title,
                          season: next.seasonNumber,
                          episode: next.episodeNumber,
                        })}
                      />
                    </>
                  ) : (
                    <Muted>
                      {item.airedCount > 0 && item.watchedCount >= item.airedCount
                        ? t('continueWatching.upToDate')
                        : t('continueWatching.noNextCached')}
                    </Muted>
                  )}
                </>
              )}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
function ListRowStatus({
  titleId,
  itemId,
  status,
}: {
  titleId: number;
  itemId: string;
  status: WatchStatus;
}) {
  const update = useUpdateStatus(titleId);
  return (
    <StatusChips value={status} onChange={(next) => update.mutate({ itemId, status: next })} />
  );
}

export function ListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [sort, setSort] = useState<WatchlistSort>('recent');
  const list = useWatchlist(status, sort, currentLocale());
  const counts = useWatchlistCounts();
  const total = counts.data ? WATCH_STATUSES.reduce((sum, s) => sum + counts.data[s], 0) : 0;

  return (
    <Screen>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('list.filterLabel')}
        className="flex-row flex-wrap gap-2"
      >
        <Chip
          label={`${t('list.all')} (${total})`}
          selected={status === null}
          onPress={() => setStatus(null)}
        />
        {WATCH_STATUSES.map((s) => (
          <Chip
            key={s}
            label={`${t(`watchlist.status.${s}`)} (${counts.data?.[s] ?? 0})`}
            selected={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('list.sortLabel')}
        className="flex-row flex-wrap gap-2"
      >
        {WATCHLIST_SORTS.map((s) => (
          <Chip
            key={s}
            label={t(`list.sort.${s}`)}
            selected={sort === s}
            onPress={() => setSort(s)}
          />
        ))}
      </View>
      {list.isPending && <Loading />}
      {list.isError && <Alert>{t('watchlist.errors.unexpected')}</Alert>}
      {list.data?.length === 0 && (
        <View className="gap-3 rounded-card bg-surface-raised p-4">
          <Text className="text-ink">
            {total === 0 ? t('list.empty') : t('list.emptyFiltered')}
          </Text>
          {total === 0 && (
            <Button
              tone="secondary"
              label={t('list.searchLink')}
              onPress={() => router.push('/search')}
            />
          )}
        </View>
      )}
      {list.data?.map((item) => (
        <View
          key={item.id}
          testID="watchlist-item"
          className="gap-3 rounded-card bg-surface-raised p-3"
        >
          <Pressable
            accessibilityRole="link"
            onPress={() => openTitle(router, item.title.mediaType, item.title.tmdbId)}
            className="flex-row gap-3"
          >
            <Poster path={item.title.posterPath} title={item.title.title} width={60} />
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-ink">{item.title.title}</Text>
              <Muted>
                {t(`catalog.mediaType.${item.title.mediaType}`)} ·{' '}
                {t(`watchlist.status.${item.status}`)}
                {item.rating !== null ? ` · ${t('list.ratingShort', { rating: item.rating })}` : ''}
              </Muted>
              {/* Notes are plain text; React Native never interprets markup. */}
              {item.notes ? (
                <Text numberOfLines={3} className="text-sm text-ink">
                  {item.notes}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <ListRowStatus titleId={item.titleId} itemId={item.id} status={item.status} />
        </View>
      ))}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const [saving, setSaving] = useState<Locale | null>(null);
  const [error, setError] = useState(false);
  const locale = currentLocale();

  const changeLanguage = async (next: Locale) => {
    if (!session) return;
    setError(false);
    setSaving(next);
    try {
      // Saved to the profile so it follows the user to the web too.
      await updateProfileLocale(supabase, session.user.id, next);
      await setAppLocale(next);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>
      <SyncStatus />
      <View className="gap-1 rounded-card bg-surface-raised p-4">
        <Muted>{t('profile.email')}</Muted>
        <Text testID="profile-email" className="text-ink">
          {session?.user.email}
        </Text>
      </View>
      <View className="gap-2 rounded-card bg-surface-raised p-4">
        <Text className="font-medium text-ink">{t('profile.language')}</Text>
        {error && <Alert>{t('errors.unexpected')}</Alert>}
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {LOCALES.map((option) => (
            <Chip
              key={option}
              label={t(`languages.${option}`)}
              selected={option === locale}
              disabled={saving !== null}
              onPress={() => void changeLanguage(option)}
            />
          ))}
        </View>
        <Muted>{t('profile.languageHelp')}</Muted>
      </View>
      <Button tone="secondary" label={t('nav.signOut')} onPress={() => void signOut()} />
      <View className="gap-3 rounded-card border border-red-500 p-4">
        <Heading>{t('account.dangerTitle')}</Heading>
        <Muted>{t('account.dangerBody')}</Muted>
        <Button
          tone="danger"
          label={t('account.deleteLink')}
          onPress={() => router.push('/delete-account')}
        />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
const DELETED_ITEMS = ['account', 'profile', 'list', 'progress', 'avatar'] as const;
type DeleteError = 'reauth_failed' | 'rate_limited' | 'unexpected';

/** Same flow as the web (K13): warning, password, explicit acknowledgement. */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const [error, setError] = useState<DeleteError | null>(null);
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '', confirm: false as unknown as true },
  });

  const submit = handleSubmit(async ({ password }) => {
    setError(null);
    setPending(true);
    try {
      // The function deletes the JWT subject only; the password re-authenticates.
      await deleteAccount(supabase, password);
    } catch (caught) {
      const code = caught instanceof AccountError ? caught.code : 'internal';
      setError(code === 'reauth_failed' || code === 'rate_limited' ? code : 'unexpected');
      setPending(false);
      return;
    }
    // The user is gone: drop the local session and every cached query.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    queryClient.clear();
    router.replace('/account-deleted');
  });

  return (
    <Screen>
      <View className="gap-3 rounded-lg border border-red-700 bg-red-700/10 p-4">
        <Text testID="delete-irreversible" className="font-semibold text-ink">
          {t('account.delete.irreversible')}
        </Text>
        <Text className="text-ink">{t('account.delete.willDelete')}</Text>
        {DELETED_ITEMS.map((item) => (
          <Text key={item} className="text-ink">
            • {t(`account.delete.items.${item}`)}
          </Text>
        ))}
        <Muted>{t('account.delete.keeps')}</Muted>
      </View>
      {error && <Alert>{t(`account.delete.errors.${error}`)}</Alert>}
      <Field
        control={control}
        name="password"
        label={t('account.delete.password')}
        hint={t('account.delete.passwordHint')}
        secure
        error={fieldError(formState.errors.password?.message)}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field }) => (
          <View className="flex-row items-center gap-3">
            <Switch
              accessibilityLabel={t('account.delete.confirm')}
              value={Boolean(field.value)}
              onValueChange={field.onChange}
            />
            <Text className="flex-1 text-ink">{t('account.delete.confirm')}</Text>
          </View>
        )}
      />
      {formState.errors.confirm?.message && (
        <Text className="text-sm text-brand-500">
          {fieldError(formState.errors.confirm.message)}
        </Text>
      )}
      <Button
        tone="danger"
        label={t('account.delete.submit')}
        pendingLabel={t('account.delete.submitting')}
        pending={pending}
        onPress={submit}
      />
      <Button tone="secondary" label={t('account.delete.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

export function AccountDeletedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <Title>{t('account.deleted.title')}</Title>
      <Text accessibilityLiveRegion="polite" className="text-ink">
        {t('account.deleted.body')}
      </Text>
      <Button label={t('account.deleted.home')} onPress={() => router.replace('/login')} />
    </Screen>
  );
}
