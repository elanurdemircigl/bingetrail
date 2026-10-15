import {
  accountErrorSchema,
  deleteAccountResponseSchema,
  type AccountErrorCode,
} from '@bingetrail/shared';

import type { TypedSupabaseClient } from './client-type';

export class AccountError extends Error {
  constructor(readonly code: AccountErrorCode) {
    super(`account request failed: ${code}`);
    this.name = 'AccountError';
  }
}

type JsonBody = { json(): Promise<unknown> };
const hasJsonBody = (value: unknown): value is JsonBody =>
  typeof value === 'object' && value !== null && typeof (value as JsonBody).json === 'function';

/**
 * Permanently deletes the CALLER's account (the function uses the JWT `sub`,
 * never a user id from the request). The password re-authenticates the user.
 */
export async function deleteAccount(client: TypedSupabaseClient, password: string): Promise<void> {
  const { data, error } = await client.functions.invoke('delete-account', { body: { password } });

  if (error) {
    const context: unknown = (error as { context?: unknown }).context;
    if (hasJsonBody(context)) {
      const parsed = accountErrorSchema.safeParse(await context.json().catch(() => null));
      throw new AccountError(parsed.success ? parsed.data.error : 'internal');
    }
    throw new AccountError('internal');
  }
  if (!deleteAccountResponseSchema.safeParse(data).success) throw new AccountError('internal');
}
