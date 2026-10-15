// delete-account Edge Function: permanently deletes the CALLER's account.
// The user id comes only from the verified JWT; the body carries just the
// password for re-authentication. The service-role key exists only here.
import { createClient } from '@supabase/supabase-js';

import { removeUserFolder } from './avatars.ts';
import { createHandler, RATE_LIMIT } from './handler.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret ${name}`);
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const noSession = { persistSession: false, autoRefreshToken: false };
const admin = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: noSession,
});

const handler = createHandler({
  async authenticate(authorization) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
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
  async verifyPassword(email, password) {
    // A throwaway anon client: the re-auth session never leaves this function.
    const client = createClient(supabaseUrl, anonKey, { auth: noSession });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return true;
  },
  async removeAvatars(userId) {
    await removeUserFolder(admin.storage.from('avatars'), userId);
  },
  async deleteUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error('auth user deletion failed');
  },
  async logDeletion(userIdHash) {
    const { error } = await admin
      .from('account_deletion_log')
      .insert({ user_id_hash: userIdHash, reason_code: 'user_request' });
    if (error) throw new Error('audit insert failed');
  },
  hashSalt: Deno.env.get('ACCOUNT_DELETION_HASH_SALT'),
  allowedOrigins: (Deno.env.get('CATALOG_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logError: (message) => console.error(message),
});

Deno.serve(handler);
