'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getProfile, updateProfileLocale } from '@bingetrail/api-client';
import type { Locale } from '@bingetrail/i18n';
import {
  forgotPasswordSchema,
  localeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthErrorCode,
} from '@bingetrail/shared';

import { RECOVERY_COOKIE } from '@/lib/auth/recovery';
import { getSessionUser, isRecoverySession } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase/server';

import { toAuthErrorCode } from './errors';

// Server Actions are public endpoints: every input is re-validated here even
// though the forms validate with the same Zod schemas on the client.

export type ActionResult = { ok: false; error: AuthErrorCode };

const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR = 60 * 60 * 24 * 365;

async function currentLocale(): Promise<Locale> {
  const parsed = localeSchema.safeParse(await getLocale());
  return parsed.success ? parsed.data : 'tr';
}

async function rememberLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', sameSite: 'lax', maxAge: ONE_YEAR });
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidCredentials' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return { ok: false, error: toAuthErrorCode(error, 'invalidCredentials') };

  // The profile's language wins over the URL the user happened to sign in from.
  const profile = await getProfile(supabase, data.user.id).catch(() => null);
  const locale = profile?.locale ?? (await currentLocale());
  await rememberLocale(locale);
  redirect(safeRedirectPath(next, `/${locale}/home`));
}

export async function signUpAction(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };

  const locale = await currentLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Read by the handle_new_user trigger and by the email templates.
    options: { data: { locale } },
  });

  if (error) {
    // Email confirmation is off (product decision, docs/auth.md): a successful
    // sign-up signs the user in, so a registered address cannot be hidden here.
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return { ok: false, error: 'emailTaken' };
    }
    const code = toAuthErrorCode(error, 'unexpected');
    if (code === 'weakPassword' || code === 'rateLimited') return { ok: false, error: code };
    return { ok: false, error: 'unexpected' };
  }

  if (data.session) {
    await rememberLocale(locale);
    redirect(`/${locale}/home`);
  }
  // Only reached if a project still requires email confirmation.
  redirect(`/${locale}/check-email?reason=signup`);
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };

  const locale = await currentLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (error && toAuthErrorCode(error, 'unexpected') === 'rateLimited') {
    return { ok: false, error: 'rateLimited' };
  }
  // Same page whether or not the address exists (no account enumeration).
  redirect(`/${locale}/check-email?reason=forgot`);
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };

  // Server Actions are callable directly: re-check the recovery marker here too.
  if (!(await isRecoverySession(await getSessionUser())))
    return { ok: false, error: 'linkInvalid' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: toAuthErrorCode(error, 'unexpected') };

  // Single use: the marker is gone once the password is changed.
  (await cookies()).delete(RECOVERY_COOKIE);
  redirect(`/${await currentLocale()}/home?passwordUpdated=1`);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  // Local scope: ends this device's session without signing out other devices.
  await supabase.auth.signOut({ scope: 'local' });
  (await cookies()).delete(RECOVERY_COOKIE);
  redirect(`/${await currentLocale()}/login`);
}

export async function updateLocaleAction(input: unknown): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };

  const user = await getSessionUser();
  if (!user) redirect(`/${await currentLocale()}/login`);

  const supabase = await createClient();
  try {
    await updateProfileLocale(supabase, user.id, parsed.data);
  } catch {
    return { ok: false, error: 'unexpected' };
  }
  await rememberLocale(parsed.data);
  redirect(`/${parsed.data}/profile`);
}
