import tseslint from 'typescript-eslint';

import base from './base.mjs';

/**
 * Shared packages (shared, api-client, i18n, db-types) must stay platform
 * independent: no React, no framework, no platform-specific Supabase client.
 * Each app owns its own Supabase client factory (see docs/adr/0001-stack.md).
 */
export default tseslint.config(...base, {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
            message: 'Shared packages must not depend on React.',
          },
          {
            group: ['next', 'next/*'],
            message: 'Shared packages must not import Next.js.',
          },
          {
            group: ['react-native', 'react-native/*', 'expo', 'expo-*', '@expo/*'],
            message: 'Shared packages must not import React Native or Expo.',
          },
          {
            group: ['@supabase/ssr', '@supabase/ssr/*'],
            message: 'Supabase clients are created per platform inside apps/*.',
          },
        ],
      },
    ],
  },
});
