import { test, expect } from '@playwright/test';

test('actual seeded catalog displays all 55 products', async ({ page }) => {
  test.skip(process.env['JEDEL_E2E_REAL_DEMO'] !== '1', 'Run with the isolated demo fixture');
  await page.goto('/auth');
  await page.getByLabel('Email address or username', {exact: true}).fill('browser-manager');
  await page.getByLabel('Password', {exact: true}).fill(process.env['JEDEL_E2E_PASSWORD']!);
  await page.locator('form').getByRole('button', {name: 'Log in', exact: true}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/products');
  const cards = page.locator('article.catalog-card[data-demo="true"]');
  await expect(cards).toHaveCount(55);
  const laptop = cards.filter({has: page.getByRole('heading', {name: 'Notebook Air 13', exact: true})});
  await laptop.locator('summary').click();
  await expect(laptop).toContainText('A compact 13-inch-class laptop concept');
  await expect(page.getByText('Descriptions of sample products are illustrative.', {exact: true})).toHaveCount(1);
  await page.reload();
  await expect(cards).toHaveCount(55);
});
