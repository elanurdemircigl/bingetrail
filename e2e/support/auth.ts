import { expect, type Page } from '@playwright/test';

import { messages } from '../../packages/i18n/src/index';

export const tr = messages.tr;
export const en = messages.en;

/** Matches the Supabase policy (8+ chars, letters and digits). */
export const PASSWORD = 'binge2026';

export const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** The form-level alert inside the page content (Next's route announcer also has role=alert). */
export const formAlert = (page: Page) => page.getByRole('main').getByRole('alert');

/** Fills and submits the sign-up form (no assertion about the outcome). */
export async function submitSignUp(page: Page, email: string, password = PASSWORD) {
  await page.goto('/tr/signup');
  await page.getByLabel(tr.auth.signup.email).fill(email);
  await page.getByLabel(tr.auth.signup.password, { exact: true }).fill(password);
  await page.getByLabel(tr.auth.signup.confirmPassword).fill(password);
  await page.getByRole('button', { name: tr.auth.signup.submit }).click();
}

/**
 * Creates an account through the UI. Email confirmation is off (docs/auth.md),
 * so the user is signed in and lands on the home page right away.
 */
export async function signUp(page: Page, email: string, password = PASSWORD) {
  await submitSignUp(page, email, password);
  await expect(page).toHaveURL(/\/tr\/home$/);
}

export async function signIn(page: Page, email: string, password: string, path = '/tr/login') {
  await page.goto(path);
  await page.getByLabel(tr.auth.login.email).fill(email);
  await page.getByLabel(tr.auth.login.password).fill(password);
  await page.getByRole('button', { name: tr.auth.login.submit }).click();
}

export async function signOut(page: Page, label = tr.nav.signOut) {
  await page.getByRole('button', { name: label }).first().click();
  await expect(page).toHaveURL(/\/(tr|en)\/login$/);
}
