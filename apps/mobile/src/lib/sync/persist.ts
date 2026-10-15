import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { createLargeSecureStore } from '../supabase/large-secure-store';

const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/**
 * The query cache and the offline mutation queue survive app restarts. They hold
 * personal data (notes, ratings), so they are encrypted at rest exactly like the
 * session (AES key in SecureStore, ciphertext in AsyncStorage).
 */
export const queryPersister = createAsyncStoragePersister({
  key: 'bt-query-cache',
  throttleTime: 1000,
  storage: createLargeSecureStore({
    secure: {
      getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
      setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
      deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
    },
    plain: AsyncStorage,
    randomBytes: (length) => Crypto.getRandomBytes(length),
  }),
});

/** Bump to discard caches written by an older app version. */
export const PERSIST_BUSTER = 'faz7-v1';
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Only plain-JSON query results are persisted. Watched-episode sets (`Set`) do
 * not survive JSON and are cheap to refetch.
 */
export const shouldPersistQuery = (query: { state: { status: string; data: unknown } }) =>
  query.state.status === 'success' && !(query.state.data instanceof Set);
