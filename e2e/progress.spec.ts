import { expect, test, type Page } from '@playwright/test';

import { signUp, tr, uniqueEmail } from './support/auth';
import { publishableKey, sessionOf, sqlValue, supabaseUrl, uuid } from './support/supabase';

// Episode tracking through the real RPCs. TMDB mock titles:
//   "Kuzey Kalesi" (tv/1399): S1 = 2 aired + 1 without a date, S2 = 2 aired
//   "Uzun Yol" (tv/4242): one season with 120 aired episodes

const p = tr.progress;
const c = tr.continueWatching;
/** Waits until no progress action is in flight (leaving earlier would abort it). */
const settled = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: p.saving })).toHaveCount(0);
const episodeBox = (page: Page, n: number) =>
  page.getByRole('checkbox', { name: p.watchedLabel.replace('{number}', String(n)) });

test('mark episodes → Continue Watching shows the next one', async ({ page }) => {
  await signUp(page, uniqueEmail('progress'));
  const { userId } = await sessionOf(page);
  await expect(page.getByText(c.empty)).toBeVisible();

  await page.goto('/tr/title/tv/1399/season/1');
  await expect(episodeBox(page, 3)).toBeDisabled(); // no air date → not aired
  await expect(page.getByTestId('episode').nth(2)).toContainText(p.notAired);

  await episodeBox(page, 1).check();
  await expect(page.getByTestId('season-progress')).toContainText('Bu sezon: 1/2 bölüm izlendi');
  await settled(page);
  await page.reload();
  await expect(episodeBox(page, 1)).toBeChecked();

  // Open season 2 so it is cached, then look at the home page.
  await page.goto('/tr/title/tv/1399/season/2');
  await expect(page.getByTestId('episode')).toHaveCount(2);

  await page.goto('/tr/home');
  const card = page.getByTestId('continue-item').filter({ hasText: 'Kuzey Kalesi' });
  await expect(card.getByTestId('continue-next')).toContainText('1. Sezon 2. Bölüm');
  await expect(card.getByTestId('continue-next')).toContainText('Kral Yolu');
  await expect(card).toContainText('1/4 bölüm');

  // "Watched" moves on; the dateless S1E3 is skipped.
  await card.getByRole('button', { name: /1\. sezon 2\. bölümü izlendi işaretle/ }).click();
  await expect(card.getByTestId('continue-next')).toContainText('2. Sezon 1. Bölüm');
  await expect(card.getByTestId('continue-next')).toContainText('Yeni Kış');

  expect(
    sqlValue(
      `select w.status || ',' || (select count(*) from public.episode_progress p where p.user_id = w.user_id)
       from public.watchlist_items w where w.user_id = '${uuid(userId)}'`,
    ),
  ).toBe('watching,2');

  // The title page shows the overall progress.
  await page.goto('/tr/title/tv/1399');
  await expect(page.getByTestId('title-progress')).toContainText('2/4 bölüm izlendi');

  // Unmarking moves "next" back.
  await page.goto('/tr/title/tv/1399/season/1');
  await episodeBox(page, 2).uncheck();
  await expect(episodeBox(page, 2)).not.toBeChecked();
  await settled(page);
  await page.reload();
  await expect(episodeBox(page, 2)).not.toBeChecked();
  await page.goto('/tr/home');
  await expect(card.getByTestId('continue-next')).toContainText('1. Sezon 2. Bölüm');
});

test('a 120-episode season is marked in one request, then completion is offered', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('bulk'));
  const { userId } = await sessionOf(page);

  await page.goto('/tr/title/tv/4242/season/1');
  await expect(page.getByTestId('episode')).toHaveCount(120);

  const actionPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['next-action'])
      actionPosts.push(request.url());
  });
  const started = Date.now();
  await page.getByRole('button', { name: p.markSeason }).click();
  await expect(page.getByTestId('season-progress')).toContainText('120/120');
  await expect(page.getByRole('status').filter({ hasText: p.saving })).toHaveCount(0);
  const elapsed = Date.now() - started;
  expect(actionPosts).toHaveLength(1);
  test.info().annotations.push({ type: 'bulk-mark-120-ms', description: String(elapsed) });

  expect(
    sqlValue(`select count(*) from public.episode_progress where user_id = '${uuid(userId)}'`),
  ).toBe('120');

  // All aired episodes watched → completion is suggested, never applied automatically.
  await page.goto('/tr/title/tv/4242');
  await expect(page.getByTestId('title-progress')).toContainText('120/120');
  const prompt = page.getByTestId('completion-prompt');
  await expect(prompt).toBeVisible();
  expect(
    sqlValue(`select status from public.watchlist_items where user_id = '${uuid(userId)}'`),
  ).toBe('watching');

  await prompt.getByRole('button', { name: p.completeYes }).click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByTestId('watchlist-control').getByLabel(tr.watchlist.statusLabel),
  ).toHaveValue('completed');
  expect(
    sqlValue(
      `select status || ',' || (completed_at is not null) from public.watchlist_items where user_id = '${uuid(userId)}'`,
    ),
  ).toBe('completed,true');

  await page.goto('/tr/home');
  await expect(page.getByText(c.empty)).toBeVisible();
});

test('the database refuses unaired episodes even when called directly', async ({ page }) => {
  await signUp(page, uniqueEmail('unaired'));
  const { accessToken, userId } = await sessionOf(page);
  await page.goto('/tr/title/tv/1399/season/1'); // caches the season
  await expect(page.getByTestId('episode')).toHaveCount(3);

  const unairedId = sqlValue(
    `select e.id from public.episodes e join public.titles t on t.id = e.title_id
     where t.tmdb_id = 1399 and t.media_type = 'tv' and e.season_number = 1 and e.episode_number = 3`,
  );
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/mark_episodes_watched`, {
    method: 'POST',
    headers: {
      apikey: publishableKey(),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_episode_ids: [Number(unairedId)] }),
  });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { message: string }).message).toBe('episode_not_aired');
  expect(
    sqlValue(`select count(*) from public.episode_progress where user_id = '${uuid(userId)}'`),
  ).toBe('0');

  // Anonymous callers cannot use the RPC at all.
  const anon = await fetch(`${supabaseUrl()}/rest/v1/rpc/get_continue_watching`, {
    method: 'POST',
    headers: { apikey: publishableKey(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(anon.status).toBe(401);
});
