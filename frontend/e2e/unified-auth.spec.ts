import { test, expect } from '@playwright/test';
test('unified modes, bookmarks, validation and responsive layout', async ({page}) => {
  if (process.env['JEDEL_ISOLATED_BROWSER'] !== '1') throw new Error('Use the isolated backend harness.');
  await page.goto('/auth?mode=login');
  await expect(page.getByRole('heading', {name: 'Welcome back', exact: true})).toBeVisible();
  await page.locator('.auth-card').screenshot({path: test.info().outputPath('auth-login-desktop.png')});
  await page.getByLabel('Email address or username', {exact: true}).fill('preserved@example.test');
  await page.getByRole('group', {name: 'Authentication mode'}).getByRole('button', {name: 'Register', exact: true}).click();
  await expect(page).toHaveURL(/auth\?mode=register/);
  await expect(page.getByRole('heading', {name: 'Create an account', exact: true})).toBeVisible();
  await expect(page.getByLabel('Email address', {exact: true})).toHaveValue('preserved@example.test');
  await page.getByLabel('Full name', {exact: true}).fill('Layout Test');
  await page.getByLabel('Password', {exact: true}).fill('long-password-928!');
  await page.getByLabel('Confirm password', {exact: true}).fill('mismatch');
  await page.locator('form').getByRole('button', {name: 'Register', exact: true}).click();
  await expect(page.locator('#confirm-error')).toHaveText('Passwords do not match.');
  await page.getByRole('button', {name: 'Show password', exact: true}).click();
  await expect(page.locator('#auth-password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', {name: 'Hide password', exact: true}).click();
  await expect(page.locator('#auth-password')).toHaveAttribute('type', 'password');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.locator('.auth-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.locator('.auth-card').screenshot({path: test.info().outputPath('auth-register-mobile.png')});
  await page.goto('/login'); await expect(page).toHaveURL(/auth\?mode=login/);
  await page.goto('/register'); await expect(page).toHaveURL(/auth\?mode=register/);
  await page.getByRole('link', {name: 'Back to Home', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Purchasing, made simple.'})).toBeVisible();
});
