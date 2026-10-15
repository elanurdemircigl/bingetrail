// Jest setup for screen tests (jest-expo + React Native Testing Library, K10).
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import mockNetInfo from '@react-native-community/netinfo/jest/netinfo-mock.js';
import { configure } from '@testing-library/react-native';

// Parallel turbo runs share the CPU; RNTL's 1 s default made findBy* flaky.
configure({ asyncUtilTimeout: 5000 });

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@react-native-community/netinfo', () => mockNetInfo);

// Screens must never touch a real backend in unit tests.
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
