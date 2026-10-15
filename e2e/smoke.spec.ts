import { expect, test } from '@playwright/test';

test.describe('web smoke', () => {
  test.describe('Turkish browser', () => {
    test.use({ locale: 'tr-TR' });

    test('root redirects to the Turkish start page', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveURL(/\/tr$/);
      await expect(page).toHaveTitle('BingeTrail');
      await expect(page.getByRole('heading', { level: 1, name: 'BingeTrail' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    });
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });

    test('root follows the browser language', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/en$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test('responses carry the baseline security headers', async ({ request }) => {
    const response = await request.get('/tr');
    const headers = response.headers();

    expect(response.ok()).toBe(true);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
