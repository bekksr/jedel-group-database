import { test, expect } from '@playwright/test';

test('team dark theme remains responsive on public sections, Account and Copilot', async ({page}) => {
  if(process.env['JEDEL_ISOLATED_BROWSER'] !== '1') throw new Error('Use isolated backend browser harness.');
  await page.goto('/');
  await page.getByRole('button',{name:'Dark theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/', '/products', '/suppliers', '/orders', '/analytics', '/auth', '/ai-assistant']) {
    await page.goto(path); await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  }
  await page.getByRole('button',{name:'Dark theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
