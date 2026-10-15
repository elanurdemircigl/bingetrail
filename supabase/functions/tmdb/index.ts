// tmdb Edge Function: the only component that talks to TMDB and the only writer
// of the catalog cache. Secrets (TMDB token, service-role key) exist only here.
import { createClient } from '@supabase/supabase-js';

import { createCatalogStore } from './catalog-store.ts';
import { createHandler } from './handler.ts';
import { createTmdbApi } from './tmdb-client.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret ${name}`);
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const admin = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RATE_LIMIT = { bucket: 'tmdb', windowSeconds: 60, maxRequests: 60 };

const handler = createHandler({
  async authenticate(authorization) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async allowRequest(userId) {
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_user_id: userId,
      p_bucket: RATE_LIMIT.bucket,
      p_window_seconds: RATE_LIMIT.windowSeconds,
      p_max_requests: RATE_LIMIT.maxRequests,
    });
    if (error) throw new Error('rate limit check failed');
    return data === true;
  },
  tmdb: createTmdbApi({
    baseUrl: Deno.env.get('TMDB_API_BASE_URL') ?? 'https://api.themoviedb.org/3',
    token: requireEnv('TMDB_API_READ_ACCESS_TOKEN'),
  }),
  store: createCatalogStore(admin),
  now: () => new Date(),
  allowedOrigins: (Deno.env.get('CATALOG_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logError: (message) => console.error(message),
});

Deno.serve(handler);
