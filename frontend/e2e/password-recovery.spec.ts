import { expect, test } from '@playwright/test';

test('logged-out user can request a generic password reset acknowledgement', async ({page}) => {
  await page.route('**/api/auth/csrf/', route => route.fulfill({status: 200, contentType: 'application/json', body: '{"csrfToken":"test"}'}));
  await page.route('**/api/auth/password-reset/', async route => {
    expect(route.request().postDataJSON()).toEqual({email: 'member@example.test'});
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({detail: 'If an account matches that email address, password reset instructions will be sent.'})});
  });
  await page.goto('/login');
  await page.getByRole('link', {name: 'Forgot password?'}).click();
  await page.getByLabel('Email address').fill('member@example.test');
  await page.getByRole('button', {name: 'Send reset link'}).click();
  await expect(page.getByRole('status')).toContainText('If an account matches that email address');
});

test('reset link submits a new password then returns to login', async ({page}) => {
  await page.route('**/api/auth/csrf/', route => route.fulfill({status: 200, contentType: 'application/json', body: '{"csrfToken":"test"}'}));
  await page.route('**/api/auth/password-reset/confirm/', async route => {
    expect(route.request().postDataJSON()).toEqual({uid: 'dGVzdA', token: 'single-use-token', new_password: 'Reset-secure-password-847!xyz', new_password_confirm: 'Reset-secure-password-847!xyz'});
    await route.fulfill({status: 200, contentType: 'application/json', body: '{"detail":"Password reset successfully."}'});
  });
  await page.goto('/password-reset/confirm/dGVzdA/single-use-token');
  await page.getByLabel('New password', {exact: true}).fill('Reset-secure-password-847!xyz');
  await page.getByLabel('Confirm new password').fill('Reset-secure-password-847!xyz');
  await page.getByRole('button', {name: 'Reset password'}).click();
  await expect(page).toHaveURL(/auth\?mode=login&passwordReset=success/);
  await expect(page.getByRole('status')).toContainText('Your password has been reset');
});
