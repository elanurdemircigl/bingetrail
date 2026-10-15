import { expect, test } from '@playwright/test';

import { formAlert, PASSWORD, signIn, signUp, tr, uniqueEmail } from './support/auth';
import { callFunction, sessionOf, sqlValue, uploadAvatar, uuid } from './support/supabase';

const d = tr.account.delete;

test('account deletion: re-authentication, irreversible removal and session cleanup', async ({
  page,
}) => {
  const email = uniqueEmail('delete');
  await signUp(page, email);
  const { accessToken, userId } = await sessionOf(page);
  const id = uuid(userId);
  const startedAt = sqlValue('select now()');

  // Personal data to be deleted: a list entry and an avatar file.
  await page.goto('/tr/title/movie/603');
  const control = page.getByTestId('watchlist-control');
  await control.getByRole('button', { name: tr.watchlist.add }).click();
  await expect(control.getByRole('button', { name: tr.watchlist.save })).toBeVisible();
  await uploadAvatar(accessToken, userId);
  expect(
    sqlValue(
      `select count(*) from storage.objects where bucket_id = 'avatars' and name like '${id}/%'`,
    ),
  ).toBe('1');

  // The function cannot be called anonymously, and a wrong password changes nothing.
  expect((await callFunction('delete-account', { password: PASSWORD })).status).toBe(401);
  const wrong = await callFunction('delete-account', { password: 'not-my-pass1' }, accessToken);
  expect(wrong.status).toBe(403);
  expect(await wrong.json()).toEqual({ error: 'reauth_failed' });

  // Step 1: the profile only links to the dedicated page.
  await page.goto('/tr/profile');
  await page.getByRole('link', { name: tr.account.deleteLink }).click();
  await expect(page).toHaveURL(/\/tr\/profile\/delete$/);
  await expect(page.getByTestId('delete-irreversible')).toHaveText(d.irreversible);
  for (const item of Object.values(d.items)) await expect(page.getByText(item)).toBeVisible();

  // Step 2: password and an explicit acknowledgement are both required.
  await page.getByLabel(d.password).fill(PASSWORD);
  await page.getByRole('button', { name: d.submit }).click();
  await expect(page.getByText(tr.validation.confirmRequired)).toBeVisible();

  await page.getByLabel(d.password).fill('not-my-pass1');
  await page.getByLabel(d.confirm).check();
  await page.getByRole('button', { name: d.submit }).click();
  await expect(formAlert(page)).toHaveText(d.errors.reauth_failed);
  expect(sqlValue(`select count(*) from auth.users where id = '${id}'`)).toBe('1');

  await page.getByLabel(d.password).fill(PASSWORD);
  await page.getByRole('button', { name: d.submit }).click();
  await expect(page).toHaveURL(/\/tr\/account-deleted$/);
  await expect(page.getByRole('heading', { name: tr.account.deleted.title })).toBeVisible();

  // Session cookies are gone and protected pages need a login again.
  const cookies = await page.context().cookies();
  expect(cookies.filter((c) => c.name.startsWith('sb-'))).toEqual([]);
  await page.goto('/tr/list');
  await expect(page).toHaveURL(/\/tr\/login/);

  // The old token no longer works and the credentials are rejected.
  expect((await callFunction('delete-account', { password: PASSWORD }, accessToken)).status).toBe(
    401,
  );
  await signIn(page, email, PASSWORD);
  await expect(formAlert(page)).toHaveText(tr.errors.invalidCredentials);

  // Database: user, profile, list rows and avatar are gone; only an anonymous audit row remains.
  expect(
    sqlValue(
      `select (select count(*) from auth.users where id = '${id}')
            + (select count(*) from public.profiles where id = '${id}')
            + (select count(*) from public.watchlist_items where user_id = '${id}')
            + (select count(*) from public.rate_limits where user_id = '${id}')
            + (select count(*) from storage.objects where bucket_id = 'avatars' and name like '${id}/%')`,
    ),
  ).toBe('0');
  expect(
    Number(
      sqlValue(
        `select count(*) from public.account_deletion_log where deleted_at >= '${startedAt}' and reason_code = 'user_request'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(1);
  expect(
    sqlValue(
      `select count(*) from public.account_deletion_log where user_id_hash like '%${id.replaceAll('-', '')}%' or user_id_hash like '%${id}%'`,
    ),
  ).toBe('0');
});

test('guests cannot open the deletion page', async ({ page }) => {
  await page.goto('/tr/profile/delete');
  await expect(page).toHaveURL(/\/tr\/login\?next=%2Ftr%2Fprofile%2Fdelete$/);
});
