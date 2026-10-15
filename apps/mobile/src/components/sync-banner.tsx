import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useLiveState, usePendingChanges } from '@/lib/sync/live-sync';

/** Offline notice with the number of queued changes; hidden while online and idle. */
export function SyncBanner() {
  const { t } = useTranslation();
  const state = useLiveState();
  const pending = usePendingChanges();
  if (state !== 'offline' && pending === 0) return null;

  return (
    <View
      testID="sync-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="gap-1 bg-surface-raised px-4 py-2"
    >
      {state === 'offline' && <Text className="text-sm text-ink">{t('sync.offlineBanner')}</Text>}
      {pending > 0 && (
        <Text className="text-sm text-ink-muted">{t('sync.pending', { count: pending })}</Text>
      )}
    </View>
  );
}

/** Small "Live / Connecting / Offline" label (profile screen). */
export function SyncStatus() {
  const { t } = useTranslation();
  const state = useLiveState();
  const dot =
    state === 'live' ? 'bg-emerald-500' : state === 'offline' ? 'bg-brand-500' : 'bg-ink-muted';
  return (
    <View
      testID="sync-status"
      accessibilityLabel={`${t('sync.label')}: ${t(`sync.${state}`)}`}
      className="flex-row items-center gap-2"
    >
      <View className={`h-2 w-2 rounded-full ${dot}`} />
      <Text className="text-sm text-ink-muted">{t(`sync.${state}`)}</Text>
    </View>
  );
}
