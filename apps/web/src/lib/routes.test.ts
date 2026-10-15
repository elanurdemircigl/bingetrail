import { describe, expect, it } from 'vitest';

import { classifyPath } from './routes';

describe('classifyPath', () => {
  it.each([
    ['/tr/home', 'tr', '/home', 'protected'],
    ['/en/list/42', 'en', '/list/42', 'protected'],
    ['/tr/title/tv/1399/season/1', 'tr', '/title/tv/1399/season/1', 'protected'],
    ['/tr/profile/', 'tr', '/profile', 'protected'],
    ['/en/profile/delete', 'en', '/profile/delete', 'protected'],
    ['/tr/account-deleted', 'tr', '/account-deleted', 'public'],
    ['/tr/login', 'tr', '/login', 'guest-only'],
    ['/en/forgot-password', 'en', '/forgot-password', 'guest-only'],
    ['/tr/reset-password', 'tr', '/reset-password', 'recovery'],
    ['/tr', 'tr', '/', 'public'],
    ['/en/check-email', 'en', '/check-email', 'public'],
  ])('%s → locale %s, section %s, %s', (path, locale, section, kind) => {
    expect(classifyPath(path)).toEqual({ locale, section, kind });
  });

  it('does not treat look-alike prefixes as protected', () => {
    expect(classifyPath('/tr/homepage').kind).toBe('public');
    expect(classifyPath('/tr/listing').kind).toBe('public');
  });

  it('falls back to the default locale when the prefix is missing', () => {
    expect(classifyPath('/home')).toEqual({ locale: 'tr', section: '/home', kind: 'protected' });
  });
});
