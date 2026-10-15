import type { AuthError } from '@supabase/supabase-js';

import type { Locale } from '@bingetrail/i18n';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toAuthErrorCode,
  type AuthErrorCode,
} from '@bingetrail/shared';

import { supabase } from '../supabase/client';

// Mobile equivalents of the web Server Actions. Input is validated with the
// same Zod schemas, and error codes are the same coarse ones, so responses never
// reveal whether an account exists (except sign-up, see docs/auth.md).

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode };

/** Mobile password-reset links come back to this exact (allow-listed) URL. */
export const RESET_REDIRECT = 'bingetrail://reset-password';

const failure = (error: AuthErrorCode): AuthResult => ({ ok: false, error });

export async function signIn(input: unknown): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return failure('invalidCredentials');
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? failure(toAuthErrorCode(error, 'invalidCredentials')) : { ok: true };
}

export async function signUp(
  input: unknown,
  locale: Locale,
): Promise<AuthResult | { ok: true; needsConfirmation: true }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return failure('unexpected');
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { locale } },
  });
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists')
      return failure('emailTaken');
    const code = toAuthErrorCode(error, 'unexpected');
    return failure(code === 'weakPassword' || code === 'rateLimited' ? code : 'unexpected');
  }
  // Only if a project still requires email confirmation.
  return data.session ? { ok: true } : { ok: true, needsConfirmation: true };
}

/** Same answer whether or not the address is registered. */
export async function requestPasswordReset(input: unknown): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return failure('unexpected');
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: RESET_REDIRECT,
  });
  if (error && toAuthErrorCode(error, 'unexpected') === 'rateLimited')
    return failure('rateLimited');
  return { ok: true };
}

const linkFailure = (error: AuthError | null): AuthResult =>
  error ? failure(toAuthErrorCode(error, 'linkInvalid')) : { ok: true };

/** Deep link: exchanges the PKCE code (only this device holds the verifier). */
export async function exchangeRecoveryCode(code: string): Promise<AuthResult> {
  if (!/^[A-Za-z0-9-]{8,200}$/.test(code)) return failure('linkInvalid');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return linkFailure(error);
}

/** Expo Go fallback: the 6-digit code from the reset email. */
export async function verifyRecoveryCode(email: string, code: string): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success || !/^\d{6}$/.test(code)) return failure('linkInvalid');
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: code,
    type: 'recovery',
  });
  return linkFailure(error);
}

export async function updatePassword(input: unknown): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return failure('unexpected');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  return error ? failure(toAuthErrorCode(error, 'unexpected')) : { ok: true };
}

/** Local scope: ends this device's session only (same as the web). */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
}
