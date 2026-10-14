import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALES, messageKeys, messages } from './index';

describe('i18n messages', () => {
  const reference = messageKeys(messages[DEFAULT_LOCALE]).sort();

  it.each(LOCALES)('%s has exactly the same keys as the default locale', (locale) => {
    expect(messageKeys(messages[locale]).sort()).toEqual(reference);
  });

  it.each(LOCALES)('%s has no empty strings', (locale) => {
    const values = reference.map((path) =>
      path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], messages[locale]),
    );
    for (const value of values) {
      expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
    }
  });
});
