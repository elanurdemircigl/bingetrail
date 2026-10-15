import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import type { TypedSupabaseClient } from '@bingetrail/api-client';
import type { Database } from '@bingetrail/db-types';

import { env } from '../env';

import { createLargeSecureStore } from './large-secure-store';

const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/**
 * The app's only Supabase client: publishable key + the user's session, so
 * RLS applies to everything. PKCE flow; sessions are encrypted at rest.
 */
export const supabase: TypedSupabaseClient = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      storage: createLargeSecureStore({
        secure: {
          getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
          setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
          deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
        },
        plain: AsyncStorage,
        randomBytes: (length) => Crypto.getRandomBytes(length),
      }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  },
);

// Refresh tokens only while the app is in the foreground (supabase-js guidance
// for React Native): timers do not run reliably in the background.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
