const BASE = 'http://bingetrail.invalid';

/**
 * Returns `value` only if it is a same-origin relative path, else `fallback`.
 * Blocks open redirects such as `//evil.com`, `/\evil.com`, `https://evil.com`
 * and control-character tricks.
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex -- explicitly rejecting control characters
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
