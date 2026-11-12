import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('visual audit: dashboard and analytics at five viewports', async ({browser}) => {
  test.setTimeout(120000);
  if(process.env['JEDEL_ISOLATED_BROWSER']!=='1') throw new Error('Use isolated PostgreSQL harness.');
  const phase = process.env['JEDEL_VISUAL_PHASE'] ?? 'regression';
  if(!['before','after','regression'].includes(phase)) throw new Error('Set JEDEL_VISUAL_PHASE=before, after or regression.');
  const directory = resolve('../backend/.runtime/visual-regression',phase!);mkdirSync(directory,{recursive:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'X-Forwarded-For':'198.51.100.80'}});
  const page = await context.newPage();
  await page.goto('/auth');await page.getByLabel('Email address or username',{exact:true}).fill('browser-manager');
  await page.getByLabel('Password',{exact:true}).fill(process.env['JEDEL_E2E_PASSWORD']!);
  await page.locator('form').getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region',{name:'Overview',exact:true})).toBeVisible();
  const evidence: object[]=[];
  for(const width of [1440,1280,768,390,375]) {
    await page.setViewportSize({width,height:1000});
    for(const section of ['Home','Analytics']) {
      await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:section,exact:true}).click();
      await expect(page.locator('main h1')).toBeVisible();
      if(section==='Analytics') await expect(page.getByRole('heading',{name:'Inventory summary',exact:true})).toBeVisible();
      const layout=await page.locator('.stats').first().evaluate(element=>({display:getComputedStyle(element).display,columns:getComputedStyle(element).gridTemplateColumns,valueDisplay:getComputedStyle(element.querySelector('strong')!).display,labelDisplay:getComputedStyle((element.querySelector('.stat-label') ?? element.querySelector('span'))!).display}));
      evidence.push({section,width,...layout});
      if(phase!=='before') {
        expect(layout.display).toBe('grid');
        await expect(page.locator('.stat-skeleton')).toHaveCount(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        const cards=page.locator('.stats').first().locator('app-stat-card');await expect(cards).toHaveCount(3);
        const boxes=await cards.evaluateAll(elements=>elements.map(element=>({x:element.getBoundingClientRect().x,y:element.getBoundingClientRect().y,width:element.getBoundingClientRect().width})));
        const columnCount=new Set(boxes.map(box=>Math.round(box.x))).size;
        expect(columnCount).toBe(width>=1024?3:width>=600?2:1);
        await expect(page.locator('main')).not.toContainText('NaN');
      }
      await page.screenshot({path:resolve(directory,`${section.toLowerCase()}-${width}.png`),fullPage:true,animations:'disabled'});
    }
  }
  writeFileSync(resolve(directory,'layout-evidence.json'),JSON.stringify(evidence,null,2));
  if(phase!=='before') {
    for(const width of [1440,1280,768,390,375]) {
      await page.setViewportSize({width,height:1000});
      for(const path of ['/products','/suppliers','/orders','/ai-assistant','/settings']) {
        await page.goto(path);await expect(page.locator('.account-summary')).toContainText('Purchasing Manager');
        await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
    await page.goto('/analytics');await expect(page.getByRole('heading',{name:'Inventory summary',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Dark theme',exact:true}).click();
    await page.screenshot({path:resolve(directory,'analytics-dark-375.png'),fullPage:true});
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  }
  await context.close();
});
