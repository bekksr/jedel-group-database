import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('actual shared catalog displays every committed product', async ({ page }) => {
  test.skip(process.env['JEDEL_E2E_SHARED_CATALOG'] !== '1', 'Run with the isolated shared-catalog fixture');
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), '../database/shared_catalog.json'), 'utf8')) as {products: {product_name: string}[]};
  await page.goto('/auth');
  await page.getByLabel('Email address or username', {exact: true}).fill('browser-manager');
  await page.getByLabel('Password', {exact: true}).fill(process.env['JEDEL_E2E_PASSWORD']!);
  await page.locator('form').getByRole('button', {name: 'Log in', exact: true}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/products');
  const cards = page.locator('article.catalog-card');
  await expect(cards).toHaveCount(fixture.products.length);
  await expect(cards.locator('h2')).toHaveText(fixture.products.map(product => product.product_name));
  await expect(page.getByText('Descriptions of sample products are illustrative.', {exact: true})).toHaveCount(0);
  await expect(page.getByText(/\[(?:DEMO|JEDEL FICTIONAL)\]/)).toHaveCount(0);
  await page.reload();
  await expect(cards).toHaveCount(fixture.products.length);
  await expect(cards.locator('h2')).toHaveText(fixture.products.map(product => product.product_name));
});
