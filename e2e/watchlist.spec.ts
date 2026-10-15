import { expect, test, type Page } from '@playwright/test';

import { formAlert, signUp, tr, uniqueEmail } from './support/auth';
import { sessionOf, sqlValue, uuid } from './support/supabase';

// The list is written with the user's own session (Server Actions + RLS).
// Titles come from the TMDB mock: "Kuzey Kalesi" (tv/1399), "Kırmızı Hap" (movie/603).

const w = tr.watchlist;
const XSS_NOTE = '<script>window.__xss = 1</script><img src=x onerror="window.__xss=2"> Harika!';

async function addFromTitlePage(page: Page, path: string, statusLabel: string) {
  await page.goto(path);
  const control = page.getByTestId('watchlist-control');
  await expect(control.getByText(w.notInList)).toBeVisible();
  await control.getByLabel(w.statusLabel).selectOption({ label: statusLabel });
  await control.getByRole('button', { name: w.add }).click();
  // Once added, the control switches to the edit view.
  await expect(control.getByRole('button', { name: w.save })).toBeVisible();
  await expect(control.getByLabel(w.statusLabel)).toHaveValue(
    Object.entries(w.status).find(([, label]) => label === statusLabel)?.[0] ?? '',
  );
}

test('add, rate, annotate, filter, sort and remove', async ({ page }) => {
  await signUp(page, uniqueEmail('list'));
  const { userId } = await sessionOf(page);

  await page.goto('/tr/list');
  await expect(page.getByText(tr.list.empty)).toBeVisible();

  // Add a series as "watching", then rate it and write a note containing markup.
  await addFromTitlePage(page, '/tr/title/tv/1399', w.status.watching);
  const control = page.getByTestId('watchlist-control');
  await control.getByLabel(w.rating).selectOption('8');
  await control.getByLabel(w.notes).fill(XSS_NOTE);
  await expect(control.getByText(`${XSS_NOTE.length} / 5000`)).toBeVisible();
  await control.getByRole('button', { name: w.save }).click();
  await expect(control.getByText(w.saved)).toBeVisible();

  // Reload: values come back from the database.
  await page.reload();
  await expect(control.getByLabel(w.rating)).toHaveValue('8');
  await expect(control.getByLabel(w.notes)).toHaveValue(XSS_NOTE);
  expect(
    sqlValue(
      `select status || ',' || (started_at is not null) || ',' || (completed_at is null) from public.watchlist_items where user_id = '${uuid(userId)}'`,
    ),
  ).toBe('watching,true,true');

  // Add a movie as "planned".
  await addFromTitlePage(page, '/tr/title/movie/603', w.status.planned);

  // List page: counts, the note rendered as text only, filters and sorting.
  await page.goto('/tr/list');
  const items = page.getByTestId('watchlist-item');
  await expect(items).toHaveCount(2);
  await expect(page.getByTestId('list-tab-all')).toContainText('(2)');
  await expect(page.getByTestId('list-tab-watching')).toContainText('(1)');
  await expect(page.getByTestId('list-tab-planned')).toContainText('(1)');
  await expect(page.getByTestId('watchlist-notes')).toHaveText(XSS_NOTE);
  expect(await page.evaluate(() => (globalThis as { __xss?: number }).__xss)).toBeUndefined();
  await expect(items.filter({ hasText: 'Kuzey Kalesi' })).toContainText('Puan: 8/10');

  await page.getByTestId('list-tab-planned').click();
  await expect(page).toHaveURL(/\/tr\/list\?status=planned$/);
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Kırmızı Hap');
  await expect(page.getByTestId('list-tab-planned')).toHaveAttribute('aria-current', 'page');

  await page.getByTestId('list-tab-all').click();
  await page.getByLabel(tr.list.sortLabel).selectOption('title');
  await page.getByRole('button', { name: tr.list.apply }).click();
  await expect(page).toHaveURL(/\/tr\/list\?sort=title$/);
  await expect(items.nth(0)).toContainText('Kırmızı Hap');
  await expect(items.nth(1)).toContainText('Kuzey Kalesi');

  await page.getByLabel(tr.list.sortLabel).selectOption('rating');
  await page.getByRole('button', { name: tr.list.apply }).click();
  await expect(items.nth(0)).toContainText('Kuzey Kalesi'); // rated first, unrated last

  // Status change from the list sets the completion date.
  const series = items.filter({ hasText: 'Kuzey Kalesi' });
  await series.getByLabel(w.statusLabel).selectOption('completed');
  await expect(page.getByTestId('list-tab-completed')).toContainText('(1)');
  expect(
    sqlValue(
      `select (completed_at is not null)::text from public.watchlist_items where user_id = '${uuid(userId)}' and status = 'completed'`,
    ),
  ).toBe('true');

  // Removal needs a second, explicit confirmation.
  await series.getByRole('button', { name: w.remove }).click();
  await expect(series.getByText(/listenden çıkarılsın mı/)).toBeVisible();
  await series.getByRole('button', { name: w.removeCancel }).click();
  await expect(items).toHaveCount(2);

  await series.getByRole('button', { name: w.remove }).click();
  await series.getByRole('button', { name: w.removeYes }).click();
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId('list-tab-all')).toContainText('(1)');
  expect(
    sqlValue(`select count(*) from public.watchlist_items where user_id = '${uuid(userId)}'`),
  ).toBe('1');
});

test('the title page shows the existing entry instead of a second add', async ({ page }) => {
  await signUp(page, uniqueEmail('list-dup'));
  await addFromTitlePage(page, '/tr/title/movie/603', w.status.completed);
  await page.reload();
  const control = page.getByTestId('watchlist-control');
  await expect(control.getByRole('button', { name: w.add })).toHaveCount(0);
  await expect(control.getByLabel(w.statusLabel)).toHaveValue('completed');
});

test('notes over the limit are rejected in the form', async ({ page }) => {
  await signUp(page, uniqueEmail('list-long'));
  await addFromTitlePage(page, '/tr/title/movie/603', w.status.planned);
  const control = page.getByTestId('watchlist-control');
  await control.getByLabel(w.notes).fill('x'.repeat(5001));
  await control.getByRole('button', { name: w.save }).click();
  await expect(control.getByText(tr.validation.notesTooLong)).toBeVisible();
  await expect(formAlert(page)).toHaveCount(0);
});

test("one user's list is invisible to another", async ({ browser }) => {
  const alice = await browser.newPage();
  await signUp(alice, uniqueEmail('list-a'));
  await addFromTitlePage(alice, '/tr/title/movie/603', w.status.watching);

  const bob = await browser.newPage();
  await signUp(bob, uniqueEmail('list-b'));
  await bob.goto('/tr/list');
  await expect(bob.getByText(tr.list.empty)).toBeVisible();
  await bob.goto('/tr/title/movie/603');
  await expect(bob.getByTestId('watchlist-control').getByText(w.notInList)).toBeVisible();

  await alice.close();
  await bob.close();
});
