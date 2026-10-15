'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { AccountError, deleteAccount } from '@bingetrail/api-client';
import { deleteAccountFormSchema } from '@bingetrail/shared';

import { RECOVERY_COOKIE } from '@/lib/auth/recovery';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type DeleteAccountErrorCode = 'reauth_failed' | 'rate_limited' | 'unexpected';
export type DeleteAccountResult = { ok: false; error: DeleteAccountErrorCode };

/** Supabase auth cookies, including chunked ones (`sb-<ref>-auth-token.0`, …). */
const isSessionCookie = (name: string) => name.startsWith('sb-');

/**
 * Permanently deletes the signed-in user's account through the delete-account
 * Edge Function, which takes the user id from the session JWT only. The
 * password is forwarded once for re-authentication and never logged.
 */
export async function deleteAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const parsed = deleteAccountFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };

  const locale = await getLocale();
  if (!(await getSessionUser())) redirect(`/${locale}/login`);

  try {
    await deleteAccount(await createClient(), parsed.data.password);
  } catch (error) {
    const code = error instanceof AccountError ? error.code : 'internal';
    if (code === 'reauth_failed' || code === 'rate_limited') return { ok: false, error: code };
    return { ok: false, error: 'unexpected' };
  }

  // The user no longer exists: drop every session cookie on this device.
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (isSessionCookie(name)) store.delete(name);
  }
  store.delete(RECOVERY_COOKIE);
  redirect(`/${locale}/account-deleted`);
}
