import { expect, test } from '@playwright/test';

test.describe('web smoke', () => {
  test('home page renders the BingeTrail shell in Turkish', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('BingeTrail');
    await expect(page.getByRole('heading', { level: 1, name: 'BingeTrail' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  });

  test('responses carry the baseline security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(response.ok()).toBe(true);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
