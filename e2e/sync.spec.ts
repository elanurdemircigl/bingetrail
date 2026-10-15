import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

import { PASSWORD, signIn, signUp, tr, uniqueEmail } from './support/auth';
import { publishableKey, sessionOf, sqlValue, supabaseUrl, uuid } from './support/supabase';

// Cross-device sync (Faz 7): a change in one session shows up in the other
// without reloading, and nobody else receives the signal.

/** A second, independent browser session of the same user. */
async function secondSession(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/tr\/home$/);
  return page;
}

const live = (page: Page) =>
  expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'live');

test('a change on one device appears on the other within 2 seconds', async ({ page, browser }) => {
  const email = uniqueEmail('sync');
  await signUp(page, email);
  const other = await secondSession(browser, email);

  // Device A watches the list; device B adds a title.
  await page.goto('/tr/list');
  await expect(page.getByText(tr.list.empty)).toBeVisible();
  await live(page);

  await other.goto('/tr/title/movie/603');
  const control = other.getByTestId('watchlist-control');
  await control.getByRole('button', { name: tr.watchlist.add }).click();
  await expect(control.getByRole('button', { name: tr.watchlist.save })).toBeVisible();
  const added = Date.now();

  await expect(page.getByTestId('watchlist-item').filter({ hasText: 'Kırmızı Hap' })).toBeVisible({
    timeout: 2_000,
  });
  test.info().annotations.push({ type: 'sync-ms', description: String(Date.now() - added) });

  // Episode progress too: B marks an episode, A's home shows Continue Watching.
  await page.goto('/tr/home');
  await live(page);
  await other.goto('/tr/title/tv/1399/season/1');
  await other
    .getByRole('checkbox', { name: tr.progress.watchedLabel.replace('{number}', '1') })
    .check();
  await expect(page.getByTestId('continue-item').filter({ hasText: 'Kuzey Kalesi' })).toBeVisible({
    timeout: 2_000,
  });

  await other.context().close();
});

test("another user's devices never receive the signal", async ({ page, browser }) => {
  // Bob listens on HIS topic with a raw Realtime client (publishable key only).
  const bobPage = await (await browser.newContext()).newPage();
  await signUp(bobPage, uniqueEmail('sync-bob'));
  const bob = await sessionOf(bobPage);
  const bobClient = createClient(supabaseUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${bob.accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: bobTopic } = await bobClient.rpc('my_realtime_topic');
  expect(bobTopic).toMatch(/^user:[0-9a-f]{64}$/);

  const received: unknown[] = [];
  const channel = bobClient
    .channel(String(bobTopic), { config: { private: false } })
    .on('broadcast', { event: 'changed' }, (msg) => received.push(msg));
  await new Promise<void>((resolve) =>
    channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()),
  );

  // Alice changes her list; her own topic is different from Bob's.
  await signUp(page, uniqueEmail('sync-alice'));
  const alice = await sessionOf(page);
  await page.goto('/tr/title/movie/603');
  await page
    .getByTestId('watchlist-control')
    .getByRole('button', { name: tr.watchlist.add })
    .click();
  await expect(
    page.getByTestId('watchlist-control').getByRole('button', { name: tr.watchlist.save }),
  ).toBeVisible();
  expect(
    sqlValue(`select count(*) from public.watchlist_items where user_id = '${uuid(alice.userId)}'`),
  ).toBe('1');

  await page.waitForTimeout(2_000);
  expect(received).toEqual([]);

  // Bob's own change does reach him (the channel works).
  await bobPage.goto('/tr/title/movie/603');
  await bobPage
    .getByTestId('watchlist-control')
    .getByRole('button', { name: tr.watchlist.add })
    .click();
  await expect.poll(() => received.length, { timeout: 3_000 }).toBeGreaterThan(0);
  expect(JSON.stringify(received)).not.toContain(alice.userId);

  await bobClient.removeAllChannels();
  await bobPage.context().close();
});

test('the browser never holds a session token for Realtime', async ({ page }) => {
  await signUp(page, uniqueEmail('sync-token'));
  await page.goto('/tr/list');
  await live(page);
  // Evaluated in the page (string form: the test tsconfig has no DOM types).
  const cookies = await page.evaluate<string>('document.cookie');
  const storage = await page.evaluate<string>(
    'JSON.stringify({ ...localStorage, ...sessionStorage })',
  );
  expect(cookies).not.toContain('sb-');
  expect(storage).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
});
