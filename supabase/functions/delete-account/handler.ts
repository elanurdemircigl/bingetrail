import { deleteAccountRequestSchema } from '../_shared/contracts/account.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

export type Caller = { id: string; email: string | null };

export interface Deps {
  /** Verifies the bearer token; the account to delete is ALWAYS this user. */
  authenticate(authorization: string | null): Promise<Caller | null>;
  /** Counts one attempt (also failed ones, to slow down password guessing). */
  allowRequest(userId: string): Promise<boolean>;
  /** Re-authentication: true only if the password belongs to this email. */
  verifyPassword(email: string, password: string): Promise<boolean>;
  /** Removes every object under avatars/<userId>/; throws if any removal fails. */
  removeAvatars(userId: string): Promise<void>;
  /** Hard-deletes the auth user; profile, list, progress and rate-limit rows cascade. */
  deleteUser(userId: string): Promise<void>;
  /** Writes the anonymous audit row (salted hash only). */
  logDeletion(userIdHash: string): Promise<void>;
  /** Server-only salt for the audit hash; undefined means "not configured". */
  hashSalt: string | undefined;
  allowedOrigins: readonly string[];
  /** Server-side diagnostics; must never receive passwords, tokens or bodies. */
  logError(message: string): void;
}

export const RATE_LIMIT = { bucket: 'delete-account', windowSeconds: 3600, maxRequests: 5 };
const MIN_SALT_LENGTH = 32;

/** Salted SHA-256 (hex) of the user id: lets support confirm a deletion without keeping the id. */
export async function hashUserId(salt: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${userId}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const errorName = (error: unknown) => (error instanceof Error ? error.name : 'unknown');

export function createHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'), deps.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')
      return errorResponse('invalid_request', { ...cors, Allow: 'POST, OPTIONS' });

    const caller = await deps.authenticate(request.headers.get('Authorization')).catch(() => null);
    if (!caller) return errorResponse('unauthorized', cors);

    // Unknown keys (e.g. a `userId`) are stripped: the target is never client-chosen.
    const parsed = deleteAccountRequestSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return errorResponse('invalid_request', cors);

    // Fail closed before any side effect if the audit salt is missing.
    const salt = deps.hashSalt;
    if (!salt || salt.length < MIN_SALT_LENGTH) {
      deps.logError('delete-account misconfigured: ACCOUNT_DELETION_HASH_SALT missing or short');
      return errorResponse('internal', cors);
    }

    try {
      if (!(await deps.allowRequest(caller.id))) {
        return errorResponse('rate_limited', {
          ...cors,
          'Retry-After': String(RATE_LIMIT.windowSeconds),
        });
      }
      if (!caller.email || !(await deps.verifyPassword(caller.email, parsed.data.password))) {
        return errorResponse('reauth_failed', cors);
      }
      // Storage first: if it fails the account still exists and the user can retry,
      // instead of leaving orphaned personal files behind a deleted account.
      await deps.removeAvatars(caller.id);
      await deps.deleteUser(caller.id);
    } catch (error) {
      deps.logError(`delete-account failed: ${errorName(error)}`);
      return errorResponse('internal', cors);
    }

    // The account is gone at this point; an audit failure must not report otherwise.
    try {
      await deps.logDeletion(await hashUserId(salt, caller.id));
    } catch (error) {
      deps.logError(`delete-account audit log failed: ${errorName(error)}`);
    }
    return json({ deleted: true }, 200, cors);
  };
}
