import { expect, test } from '@playwright/test';

import {
  en,
  formAlert,
  PASSWORD,
  signIn,
  signOut,
  signUp,
  signUpAndConfirm,
  tr,
  uniqueEmail,
} from './support/auth';
import { getAuthLinkPath } from './support/mailpit';

test.describe('access control', () => {
  test('guests are sent to login and keep the requested page as `next`', async ({ page }) => {
    await page.goto('/tr/list');
    await expect(page).toHaveURL(/\/tr\/login\?next=%2Ftr%2Flist$/);
  });

  test('reset-password without a recovery session goes to forgot-password', async ({ page }) => {
    await page.goto('/tr/reset-password');
    await expect(page).toHaveURL(/\/tr\/forgot-password$/);
  });

  test('a tampered confirmation link is rejected', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=forged&type=email&locale=tr');
    await expect(page).toHaveURL(/\/tr\/login\?error=linkInvalid$/);
    await expect(formAlert(page)).toHaveText(tr.errors.linkInvalid);
  });

  test('`next` cannot redirect to another site', async ({ page }) => {
    const email = uniqueEmail('next');
    await signUpAndConfirm(page, email);
    await signOut(page);

    await signIn(page, email, PASSWORD, '/tr/login?next=%2F%2Fevil.example');
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/tr\/home$/);
  });
});

test.describe('sign up, sign in, sign out', () => {
  test('full lifecycle with HttpOnly session cookies', async ({ page, context }) => {
    const email = uniqueEmail('life');
    await signUpAndConfirm(page, email);
    await expect(page.getByRole('heading', { name: tr.pages.home.welcome })).toBeVisible();

    const sessionCookies = (await context.cookies()).filter((c) => c.name.startsWith('sb-'));
    expect(sessionCookies.length).toBeGreaterThan(0);
    for (const cookie of sessionCookies) {
      expect(cookie.httpOnly, `${cookie.name} must be HttpOnly`).toBe(true);
      expect(cookie.sameSite).toBe('Lax');
    }

    // Signed-in users do not see guest pages.
    await page.goto('/tr/login');
    await expect(page).toHaveURL(/\/tr\/home$/);

    await page.getByRole('link', { name: tr.nav.profile }).click();
    await expect(page.getByTestId('profile-email')).toHaveText(email);

    await signOut(page);
    await page.goto('/tr/home');
    await expect(page).toHaveURL(/\/tr\/login/);

    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/tr\/home$/);
  });

  test('sign-in returns to the originally requested page', async ({ page }) => {
    const email = uniqueEmail('return');
    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto('/tr/calendar');
    await page.getByLabel(tr.auth.login.email).fill(email);
    await page.getByLabel(tr.auth.login.password).fill(PASSWORD);
    await page.getByRole('button', { name: tr.auth.login.submit }).click();
    await expect(page).toHaveURL(/\/tr\/calendar$/);
  });
});

test.describe('no account enumeration', () => {
  test('wrong password and unknown email produce the same message', async ({ page }) => {
    const email = uniqueEmail('enum');
    await signUpAndConfirm(page, email);
    await signOut(page);

    await signIn(page, email, 'wrong-password-1');
    await expect(formAlert(page)).toHaveText(tr.errors.invalidCredentials);

    await signIn(page, uniqueEmail('nobody'), 'wrong-password-1');
    await expect(formAlert(page)).toHaveText(tr.errors.invalidCredentials);
  });

  test('signing up with a registered email looks like a normal sign-up', async ({ page }) => {
    const email = uniqueEmail('dupe');
    await signUpAndConfirm(page, email);
    await signOut(page);

    await signUp(page, email); // asserts the same "check your email" page
    await expect(page.getByRole('status')).toHaveText(tr.auth.checkEmail.signupBody);
  });

  test('forgot-password gives the same answer for unknown addresses', async ({ page }) => {
    await page.goto('/tr/forgot-password');
    await page.getByLabel(tr.auth.forgot.email).fill(uniqueEmail('ghost'));
    await page.getByRole('button', { name: tr.auth.forgot.submit }).click();
    await expect(page.getByRole('status')).toHaveText(tr.auth.checkEmail.forgotBody);
  });
});

test.describe('password reset', () => {
  test('a normal session cannot open the reset form', async ({ page, context }) => {
    const email = uniqueEmail('noreset');
    // Session from the signup-confirmation link (Supabase amr "otp", like recovery).
    await signUpAndConfirm(page, email);
    await page.goto('/tr/reset-password');
    await expect(page).toHaveURL(/\/tr\/profile$/);

    // Session from a password sign-in.
    await signOut(page);
    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/tr\/home$/);
    await page.goto('/tr/reset-password');
    await expect(page).toHaveURL(/\/tr\/profile$/);

    // A forged marker cookie does not help either.
    await context.addCookies([
      { name: 'bt_recovery', value: 'eyJzdWIiOiJ4In0.forged', url: 'http://127.0.0.1:3100' },
    ]);
    await page.goto('/tr/reset-password');
    await expect(page).toHaveURL(/\/tr\/profile$/);
  });

  test('the emailed recovery link opens the form once and sets a new password', async ({
    page,
    context,
  }) => {
    const email = uniqueEmail('reset');
    const newPassword = 'trail2027';
    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto('/tr/forgot-password');
    await page.getByLabel(tr.auth.forgot.email).fill(email);
    await page.getByRole('button', { name: tr.auth.forgot.submit }).click();
    await expect(page.getByRole('status')).toHaveText(tr.auth.checkEmail.forgotBody);

    await page.goto(await getAuthLinkPath(email, 'recovery'));
    await expect(page).toHaveURL(/\/tr\/reset-password$/);
    const marker = (await context.cookies()).find((c) => c.name === 'bt_recovery');
    expect(marker?.httpOnly, 'recovery marker must be HttpOnly').toBe(true);
    expect(page.url()).not.toContain('token');

    await page.getByLabel(tr.auth.reset.password, { exact: true }).fill(newPassword);
    await page.getByLabel(tr.auth.reset.confirmPassword).fill(newPassword);
    await page.getByRole('button', { name: tr.auth.reset.submit }).click();
    await expect(page.getByRole('status')).toHaveText(tr.auth.passwordUpdated);

    // Single use: the marker is gone, so the form is closed again.
    expect((await context.cookies()).some((c) => c.name === 'bt_recovery')).toBe(false);
    await page.goto('/tr/reset-password');
    await expect(page).toHaveURL(/\/tr\/profile$/);

    await signOut(page);
    await signIn(page, email, PASSWORD);
    await expect(formAlert(page)).toHaveText(tr.errors.invalidCredentials);
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/tr\/home/);
  });
});

test('language preference is saved to the profile and follows the user', async ({ page }) => {
  const email = uniqueEmail('lang');
  await signUpAndConfirm(page, email);

  await page.getByRole('link', { name: tr.nav.profile }).click();
  await page.getByLabel(tr.profile.language).selectOption('en');
  await page.getByRole('button', { name: tr.profile.save }).click();
  await expect(page).toHaveURL(/\/en\/profile$/);
  await expect(page.getByRole('heading', { name: en.profile.title })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // A fresh sign-in from the Turkish login page lands in English.
  await signOut(page, en.nav.signOut);
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/home$/);
  await expect(page.getByRole('heading', { name: en.pages.home.welcome })).toBeVisible();
});

test('guests can switch the language of auth pages', async ({ page }) => {
  await page.goto('/tr/login');
  await page.getByRole('link', { name: en.languages.en }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole('heading', { name: en.auth.login.title })).toBeVisible();
});
