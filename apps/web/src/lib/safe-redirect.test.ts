import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './safe-redirect';

const FALLBACK = '/tr/home';

describe('safeRedirectPath', () => {
  it.each(['/tr/list', '/en/profile?tab=1', '/tr/search#top'])('keeps relative path %s', (path) => {
    expect(safeRedirectPath(path, FALLBACK)).toBe(path);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute URL', 'https://evil.com/tr/home'],
    ['backslash trick', '/\\evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['header injection', '/tr/home\r\nSet-Cookie: x=1'],
    ['tab inside', '/\t/evil.com'],
    ['empty', ''],
    ['non-string', 42],
    ['undefined', undefined],
    ['overly long', `/${'a'.repeat(3000)}`],
  ])('falls back for %s', (_label, value) => {
    expect(safeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
  });

  it('keeps percent-encoded slashes as a same-origin path', () => {
    // Browsers resolve this to a path on our origin, never to evil.com.
    expect(safeRedirectPath('/%2F%2Fevil.com', FALLBACK)).toBe('/%2F%2Fevil.com');
  });
});
