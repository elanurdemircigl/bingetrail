import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/lib/auth/session';
import { i18n, initI18n, restoreSavedLocale } from '@/lib/i18n';
import { createQueryClient } from '@/lib/queries';

import '../global.css';
import { colors } from '@/theme';

initI18n();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    void restoreSavedLocale();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
          </SessionProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
