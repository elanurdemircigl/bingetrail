import type { AccountErrorCode } from './contracts/account.ts';
import type { CatalogErrorCode } from './contracts/catalog.ts';

export type ErrorCode = CatalogErrorCode | AccountErrorCode;

const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info';

/**
 * CORS headers only for explicitly allowed browser origins. The web app calls
 * functions from its server and mobile is not a browser, so by default no
 * origin is allowed.
 */
export function corsHeaders(origin: string | null, allowedOrigins: readonly string[]): HeadersInit {
  if (!origin || !allowedOrigins.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  rate_limited: 429,
  not_found: 404,
  upstream_unavailable: 502,
  reauth_failed: 403,
  internal: 500,
};

/** Error responses carry only a code — never messages, stacks or upstream bodies. */
export function errorResponse(code: ErrorCode, headers: HeadersInit = {}): Response {
  return json({ error: code }, STATUS[code], headers);
}
