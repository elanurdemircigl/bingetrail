// Wire contract between clients and the `delete-account` Edge Function.
// SOURCE OF TRUTH — synced to supabase/functions/_shared/contracts/ by
// `pnpm contracts:sync`. Keep it dependency-free except for `zod`.
import { z } from 'zod';

/**
 * The account to delete is NEVER taken from the body: the function uses the
 * JWT `sub` only. The body carries just the password for re-authentication.
 */
export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});

export const deleteAccountResponseSchema = z.object({ deleted: z.literal(true) });

export const ACCOUNT_ERROR_CODES = [
  'unauthorized',
  'invalid_request',
  'reauth_failed',
  'rate_limited',
  'internal',
] as const;
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];
export const accountErrorSchema = z.object({ error: z.enum(ACCOUNT_ERROR_CODES) });

export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
