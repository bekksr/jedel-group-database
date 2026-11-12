import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page, username: string) {
  await page.goto('/auth');
  await page.getByLabel('Email address or username',{exact:true}).fill(username);
  await page.getByLabel('Password',{exact:true}).fill(process.env['JEDEL_E2E_PASSWORD']!);
  await page.locator('form').getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
}
test('anonymous and Basic use real safe Copilot search on desktop and mobile',async({browser})=>{
  if(process.env['JEDEL_ISOLATED_BROWSER']!=='1') throw new Error('Use isolated PostgreSQL harness.');
  for(const username of ['', 'browser-basic-pages']) {
    // Separate simulated clients keep independent scenarios from consuming the
    // existing suite's shared login-IP bucket. Production throttles stay intact.
    const context=await browser.newContext({extraHTTPHeaders:{'X-Forwarded-For':username ? '198.51.100.21' : '198.51.100.20'}});const page=await context.newPage();
    if(username) await login(page,username);else await page.goto('/');
    await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'AI Assistant',exact:true}).click();
    await expect(page.getByRole('heading',{name:'AI Procurement Copilot',exact:true})).toBeVisible();
    await page.getByLabel('Product name',{exact:true}).fill('Public catalog');
    await page.getByLabel('Category',{exact:true}).fill('Hardware');
    await page.getByRole('button',{name:'Search catalog',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Public catalog hardware',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Public catalog office',exact:true})).toHaveCount(0);
    await expect(page.getByText('AI chat is not configured.',{exact:false})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Best offer finder',exact:true})).toHaveCount(0);
    const safe=await page.request.post('/api/ai/products/search/',{data:{query:'Public catalog'},headers:{'X-CSRFToken':(await context.cookies()).find(cookie=>cookie.name==='csrftoken')!.value}});
    expect(safe.status()).toBe(200);
    for(const product of (await safe.json()).results) expect(Object.keys(product).sort()).toEqual(['category','product_id','product_name']);
    for(const secret of ['90321.67','4321','private-role@example.test']) await expect(page.locator('main')).not.toContainText(secret);
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await context.close();
  }
});

test('authorized Copilot compares actual test quotations and drafts without business writes',async({page})=>{
  if(process.env['JEDEL_ISOLATED_BROWSER']!=='1') throw new Error('Use isolated PostgreSQL harness.');
  await page.context().setExtraHTTPHeaders({'X-Forwarded-For':'198.51.100.22'});
  await login(page,'browser-employee');await page.goto('/ai-assistant');
  await expect(page.locator('.account-summary')).toContainText('Purchasing Employee');
  await expect(page.getByRole('heading',{name:'Best offer finder',exact:true})).toBeVisible();
  await page.getByLabel('Product name',{exact:true}).fill('Public catalog hardware');await page.getByRole('button',{name:'Search catalog',exact:true}).click();
  const card=page.locator('.product-card').filter({has:page.getByRole('heading',{name:'Public catalog hardware',exact:true})});
  await card.getByRole('button').click();
  await page.getByLabel('Required quantity (individual items)',{exact:true}).fill('10');
  const products=await (await page.request.get('/api/products/')).json();
  const product=products.results.find((p:{product_name:string})=>p.product_name==='Public catalog hardware');
  const suppliers=await (await page.request.get('/api/ai/suppliers/')).json();const supplier=suppliers.results.find((s:{supplier_name:string})=>s.supplier_name==='Role matrix supplier');
  const ordersBefore=await (await page.request.get('/api/orders/')).json();
  const quoted=new Date(Date.now()-86400000).toISOString();const expiry=new Date(Date.now()+864000000).toISOString();
  const header='product_id,supplier_id,unit_price,currency,unit,available_quantity,min_order_quantity,delivery_cost,delivery_days,quoted_at,valid_until,source,reference,specifications';
  const csv=header+'\n'+`${product.product_id},${supplier.supplier_id},10.25,KZT,pcs,100,1,5.00,3,${quoted},${expiry},Approved isolated test quotation,quote-browser,Human checked item specification`;
  await page.getByLabel('Quotation CSV',{exact:true}).setInputFiles({name:'approved-test.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByText('These quotations come from a source approved for our purchasing use.',{exact:true}).click();
  await page.getByText('I checked product specifications, quantities, item units and product equivalence.',{exact:true}).click();
  await page.getByRole('button',{name:'Compare quotations',exact:true}).click();
  const table=page.getByRole('region',{name:'Supplier quotation comparison'});
  await expect(table).toContainText('107.50 KZT');await expect(table).toContainText('quote-browser');await expect(table).toContainText('10.7500');
  await page.getByLabel('Supplier',{exact:true}).selectOption({label:`${supplier.supplier_name} (#${supplier.supplier_id})`});
  await page.getByRole('button',{name:'Prepare review-only draft',exact:true}).click();await expect(page.getByRole('heading',{name:'Draft proposal — not saved',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Review inventory',exact:true}).click();await expect(page.getByText('PostgreSQL inventory · Threshold 20',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Use local low-stock question',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ask Copilot',exact:true})).toBeEnabled();
  await expect(page.getByText('Ready: this question runs locally in Django.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Ask Copilot',exact:true}).click();
  await expect(page.locator('.conversation')).toContainText('Inventory read from PostgreSQL');
  const ordersAfter=await (await page.request.get('/api/orders/')).json();expect(ordersAfter.count).toBe(ordersBefore.count);
  const productAfter=await (await page.request.get(`/api/products/${product.product_id}/`)).json();expect(productAfter.stock_quantity).toBe(product.stock_quantity);
  const text=await page.locator('main').innerText();expect(text).not.toContain('private-role@example.test');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
