import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Marks a session that was started by a password-recovery email link.
 *
 * Supabase labels both recovery and signup-confirmation sign-ins as
 * amr "otp", so the JWT alone cannot tell them apart. /auth/confirm therefore
 * sets this HttpOnly cookie ONLY after verifying a `type=recovery` token. It is
 * HMAC-signed with a server-only secret and bound to the user (`sub`) and the
 * exact session (`session_id`), expires after 15 minutes and is deleted after
 * the password is changed. Nothing is ever put in the URL.
 */
export const RECOVERY_COOKIE = 'bt_recovery';
export const RECOVERY_TTL_SECONDS = 15 * 60;
const MIN_SECRET_LENGTH = 32;

export type SessionBinding = { userId: string; sessionId: string };

function serverSecret(): string | null {
  const secret = process.env.AUTH_COOKIE_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/** Returns the cookie value, or null when no server secret is configured (fail closed). */
export function createRecoveryMarker(
  binding: SessionBinding,
  nowMs = Date.now(),
  secret = serverSecret(),
): string | null {
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({
      sub: binding.userId,
      sid: binding.sessionId,
      exp: Math.floor(nowMs / 1000) + RECOVERY_TTL_SECONDS,
    }),
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidRecoveryMarker(
  value: string | undefined,
  binding: SessionBinding | null,
  nowMs = Date.now(),
  secret = serverSecret(),
): boolean {
  if (!value || !binding || !secret) return false;
  const [payload, signature, ...rest] = value.split('.');
  if (!payload || !signature || rest.length > 0) return false;

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      sid?: unknown;
      exp?: unknown;
    };
    return (
      data.sub === binding.userId &&
      data.sid === binding.sessionId &&
      typeof data.exp === 'number' &&
      data.exp > Math.floor(nowMs / 1000)
    );
  } catch {
    return false;
  }
}

export function recoveryCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax: the email link is a cross-site top-level navigation; Strict would drop it.
    sameSite: 'lax' as const,
    path: '/',
    maxAge: RECOVERY_TTL_SECONDS,
  };
}

/** Logged once by callers when recovery cannot work because the secret is missing. */
export const hasRecoverySecret = () => serverSecret() !== null;
