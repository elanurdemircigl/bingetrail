import { expect, test, type Page } from '@playwright/test';

import { en, signUpAndConfirm, tr, uniqueEmail } from './support/auth';

// Catalog flows run through the real tmdb Edge Function and database cache,
// with TMDB replaced by e2e/tmdb-mock (fixtures: "Kırmızı Hap", "Kuzey Kalesi").

async function signedIn(page: Page) {
  await signUpAndConfirm(page, uniqueEmail('catalog'));
}

test('guests cannot open catalog pages', async ({ page }) => {
  await page.goto('/tr/title/movie/603');
  await expect(page).toHaveURL(/\/tr\/login\?next=%2Ftr%2Ftitle%2Fmovie%2F603$/);
});

test('search → series → season → episodes', async ({ page }) => {
  await signedIn(page);
  await page
    .getByRole('navigation', { name: tr.nav.mainNav })
    .getByRole('link', { name: tr.nav.search })
    .click();
  await expect(page.getByText(tr.catalog.search.hint)).toBeVisible();

  await page.getByLabel(tr.catalog.search.label).fill('kale');
  await expect(page).toHaveURL(/\/tr\/search\?q=kale$/);

  const results = page.getByRole('region', { name: /sonuç/ });
  await expect(results.getByRole('link', { name: /Kırmızı Hap/ })).toBeVisible();
  await expect(results.getByRole('link', { name: /Kuzey Kalesi/ })).toBeVisible();
  await expect(page.getByText('Örnek Oyuncu')).toHaveCount(0); // people are filtered out

  await results.getByRole('link', { name: /Kuzey Kalesi/ }).click();
  await expect(page).toHaveURL(/\/tr\/title\/tv\/1399$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Kuzey Kalesi' })).toBeVisible();
  await expect(page.getByText('Özgün adı: Northern Keep')).toBeVisible();
  await expect(page.getByText(tr.catalog.statusLabels.ended)).toBeVisible();

  const seasons = page.getByRole('region', { name: tr.catalog.seasons });
  await expect(seasons.getByRole('link')).toHaveCount(3);
  await seasons.getByRole('link', { name: /1\. Sezon/ }).click();

  await expect(page).toHaveURL(/\/tr\/title\/tv\/1399\/season\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: '1. Sezon' })).toBeVisible();
  const episodes = page.getByTestId('episode');
  await expect(episodes).toHaveCount(3);
  await expect(episodes.nth(0)).toContainText('Kış Kapıda');
  await expect(episodes.nth(0)).toContainText('62 dk');
  await expect(episodes.nth(2)).toContainText(tr.catalog.dateUnknown);

  await page.getByRole('link', { name: tr.catalog.backToTitle }).click();
  await expect(page).toHaveURL(/\/tr\/title\/tv\/1399$/);
});

test('movie detail, English locale and attribution', async ({ page }) => {
  await signedIn(page);
  await page.goto('/tr/title/movie/603');
  await expect(page.getByRole('heading', { level: 1, name: 'Kırmızı Hap' })).toBeVisible();
  await expect(page.getByText('31 Mart 1999')).toBeVisible();
  await expect(page.getByText(tr.catalog.attribution)).toBeVisible();

  await page.goto('/en/title/movie/603');
  await expect(page.getByRole('heading', { level: 1, name: 'The Red Pill' })).toBeVisible();
  await expect(page.getByText('March 31, 1999')).toBeVisible();
  await expect(page.getByText(en.catalog.attribution)).toBeVisible();
});

test('empty results, unknown titles and malformed URLs', async ({ page }) => {
  await signedIn(page);

  await page.goto('/tr/search?q=yokboylebirsey');
  await expect(page.getByRole('status')).toHaveText('“yokboylebirsey” için sonuç bulunamadı.');

  for (const path of [
    '/tr/title/movie/999999',
    '/tr/title/person/1',
    '/tr/title/movie/1e3',
    '/tr/title/movie/603/season/1',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: tr.notFound.title }), path).toBeVisible();
  }
});
