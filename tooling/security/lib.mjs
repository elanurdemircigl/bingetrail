// Shared helpers for BingeTrail secret scanners. No dependencies: runs on plain Node 24.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECURITY_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(SECURITY_DIR, '..', '..');

/**
 * @typedef {{ rule: string, path?: string, reason: string }} AllowlistEntry
 * @typedef {{ publicEnv: string[], findings: AllowlistEntry[] }} Allowlist
 * @typedef {{ rule: string, message: string, file?: string, sample?: string }} Finding
 */

/** @returns {Allowlist} */
export function loadAllowlist(path = join(SECURITY_DIR, 'allowlist.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Decodes a JWT payload without verifying it. Returns null for anything malformed.
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
export function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Classifies a JWT as a known secret type, or null when it is safe to ship
 * (e.g. the legacy Supabase `anon` key, which is public by design).
 * @param {string} token
 * @returns {string | null}
 */
export function classifySecretJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (payload.role === 'service_role') return 'supabase-service-role-jwt';
  if (Array.isArray(payload.scopes) && payload.scopes.includes('api_read'))
    return 'tmdb-read-token';
  return null;
}

/**
 * Never print a full secret: keep a short prefix for locating it.
 * @param {string} value
 */
export function redact(value) {
  return value.length <= 12 ? '***' : `${value.slice(0, 12)}…(${value.length} chars)`;
}

/**
 * @param {Finding} finding
 * @param {Allowlist} allowlist
 */
export function isAllowlisted(finding, allowlist) {
  return allowlist.findings.some(
    (entry) =>
      entry.rule === finding.rule &&
      (!entry.path || (finding.file ?? '').replaceAll('\\', '/').includes(entry.path)),
  );
}
