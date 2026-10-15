import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { colors } from '@/theme';

/** Signed-in area: without a session every screen here sends the user to login. */
export default function AppLayout() {
  const { t } = useTranslation();
  const { session, loading } = useSession();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.surface },
        headerBackTitle: t('catalog.backToTitle'),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="title/[mediaType]/[tmdbId]" options={{ title: '' }} />
      <Stack.Screen name="season/[tmdbId]/[seasonNumber]" options={{ title: '' }} />
      <Stack.Screen name="delete-account" options={{ title: t('account.delete.title') }} />
    </Stack>
  );
}
