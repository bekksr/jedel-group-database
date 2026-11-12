import { test, expect } from '@playwright/test';
const roles = [
 {name:'Anonymous', username:'', read:false},
 {name:'Basic User', username:'browser-basic-pages',read:false},
 {name:'Purchasing Employee',username:'browser-employee',read:true},
 {name:'Purchasing Manager',username:'browser-manager',read:true},
 {name:'Analyst / Tester',username:'browser-analyst',read:true},
 {name:'System Administrator',username:'browser-admin',read:true},
 {name:'Security Administrator',username:'browser-security',read:false},
];
test('all five sections support every role without leaking private data',async({browser})=>{
 test.setTimeout(90000);
 if(process.env['JEDEL_ISOLATED_BROWSER']!=='1') throw new Error('Use isolated backend harness.');
 for(const role of roles) {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const privateRequests:string[]=[];
  page.on('request',request=>{if(/\/api\/(access|products|suppliers|orders|analytics|dashboard)\//.test(request.url())) privateRequests.push(request.url());});
  if(role.username) {
   await page.goto('/auth'); await page.getByLabel('Email address or username',{exact:true}).fill(role.username);
   await page.getByLabel('Password',{exact:true}).fill(process.env['JEDEL_E2E_PASSWORD']!);
   await page.locator('form').getByRole('button',{name:'Log in',exact:true}).click();
   await expect(page.locator('.account-summary')).toContainText(role.name);
   await expect(page).toHaveURL(/\/$/);
   if(role.read) await expect(page.getByRole('region',{name:'Overview',exact:true})).toBeVisible();
  } else await page.goto('/');
  for(const section of ['Home','Products','Suppliers','Orders','Analytics']) {
   await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:section,exact:true}).click();
   await expect(page.locator('main h1')).toBeVisible();
   await expect(page.locator('main')).not.toContainText('Access denied.');
   if(!role.read) {
    for(const secret of ['private-role@example.test','ROLE-PRIVATE-PHONE','Role matrix supplier','90,321.67','9,876 units']) await expect(page.locator('main')).not.toContainText(secret);
    if(section==='Suppliers') await expect(page.getByRole('heading',{name:'Supplier management workflow',exact:true})).toBeVisible();
    if(section==='Orders') await expect(page.getByText('not customer sales orders or checkout',{exact:false})).toBeVisible();
    if(section==='Analytics') await expect(page.getByRole('heading',{name:'Report definitions before figures',exact:true})).toBeVisible();
    if(section==='Products') await expect(page.getByRole('heading',{name:'Public catalog hardware',exact:true})).toBeVisible();
   } else {
    if(section==='Products') await expect(page.getByText('Warehouse stock',{exact:true}).first()).toBeVisible();
    if(section==='Suppliers') await expect(page.getByText('private-role@example.test',{exact:true})).toBeVisible();
    if(section==='Analytics') {await expect(page.getByRole('heading',{name:'Inventory summary',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Supplier spending',exact:true})).toBeVisible();}
    if(section==='Orders') {
     const orders=await (await page.request.get('/api/orders/')).json();
     const pending=orders.results.find((order:{status:string})=>order.status==='Pending');
     await page.getByRole('button',{name:'View order '+pending.order_id,exact:true}).click();
     await expect(page.getByRole('button',{name:'Mark Approved',exact:true})).toHaveCount(['Purchasing Manager','System Administrator'].includes(role.name)?1:0);
     if(role.name==='Analyst / Tester') await expect(page.getByRole('button',{name:'New order',exact:true})).toBeDisabled();
    }
   }
  }
  if(!role.read) {
   expect(privateRequests).toEqual([]);
   await page.setViewportSize({width:390,height:900});
   for(const section of ['Home','Products','Suppliers','Orders','Analytics']) {
    await page.getByRole('navigation').getByRole('link',{name:section,exact:true}).click();
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
  }
  if(role.name==='Basic User') {
   await page.getByRole('link',{name:'Request access',exact:true}).click();
   await expect(page).toHaveURL(/access\?section=analytics/);
   await expect(page.getByRole('heading',{name:'Request workspace access',exact:true})).toBeVisible();
   await expect(page.getByText('does not submit or approve a request automatically',{exact:false})).toBeVisible();
  }
  await context.close();
 }
});
test('authorized pages report unavailable backend without fake data',async({page})=>{
 if(process.env['JEDEL_ISOLATED_BROWSER']!=='1') throw new Error('Use isolated backend harness.');
 await page.route('**/api/dashboard/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Temporarily unavailable'})}));
 await page.goto('/auth');await page.getByLabel('Email address or username',{exact:true}).fill('browser-employee');
 await page.getByLabel('Password',{exact:true}).fill(process.env['JEDEL_E2E_PASSWORD']!);await page.locator('form').getByRole('button',{name:'Log in',exact:true}).click();
 await expect(page.locator('.account-summary')).toContainText('Purchasing Employee');
 for(const name of ['Home','Products','Suppliers','Orders','Analytics']) {
  await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry workspace',exact:true})).toBeVisible();
  await expect(page.locator('main [role=alert]')).toHaveCount(1);
 }
});
