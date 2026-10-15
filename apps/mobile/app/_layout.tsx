import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/lib/auth/session';
import { i18n, initI18n, restoreSavedLocale } from '@/lib/i18n';
import { createQueryClient } from '@/lib/queries';
import { setupOnlineManager } from '@/lib/sync/network';
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  queryPersister,
  shouldPersistQuery,
} from '@/lib/sync/persist';

import '../global.css';
import { colors } from '@/theme';

initI18n();
setupOnlineManager();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    void restoreSavedLocale();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: PERSIST_MAX_AGE,
            buster: PERSIST_BUSTER,
            dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
          }}
          // Changes queued offline before the app was closed are sent now.
          onSuccess={() => {
            void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
          }}
        >
          <SessionProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
          </SessionProvider>
        </PersistQueryClientProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
