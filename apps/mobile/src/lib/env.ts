// Public settings only. Expo inlines EXPO_PUBLIC_* at build time, so they must be
// read with these exact static expressions. The Supabase secret/service-role key
// and the TMDB token never belong here (see .env.example and docs/mobile.md).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing. Start the app with `pnpm dev:mobile`.',
  );
}
// Defence in depth: refuse to run with a secret key in the bundle.
if (publishableKey.startsWith('sb_secret_')) {
  throw new Error(
    'A Supabase SECRET key was configured for the mobile app. Use the publishable key.',
  );
}

export const env = { supabaseUrl: url, supabasePublishableKey: publishableKey } as const;
