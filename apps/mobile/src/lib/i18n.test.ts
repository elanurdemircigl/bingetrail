import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors } from '@/theme';

import { i18n, initI18n, isLocale } from './i18n';

beforeAll(() => {
  initI18n('tr');
});

describe('shared TR/EN messages with ICU', () => {
  it('renders plurals and interpolation in both languages', async () => {
    await i18n.changeLanguage('tr');
    expect(i18n.t('catalog.search.resultCount', { count: 3 })).toBe('3 sonuç');
    expect(i18n.t('progress.bar', { watched: 2, aired: 5 })).toBe('2/5 bölüm izlendi');
    await i18n.changeLanguage('en');
    expect(i18n.t('catalog.search.resultCount', { count: 1 })).toBe('1 result');
    expect(i18n.t('catalog.search.resultCount', { count: 2 })).toBe('2 results');
  });

  it('only accepts supported locales', () => {
    expect(isLocale('tr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('theme', () => {
  it('mirrors the shared design tokens', () => {
    const tokens = readFileSync(
      join(__dirname, '../../../../packages/config/tokens/index.mjs'),
      'utf8',
    ).toLowerCase();
    for (const hex of Object.values(colors)) expect(tokens).toContain(hex.toLowerCase());
  });
});
