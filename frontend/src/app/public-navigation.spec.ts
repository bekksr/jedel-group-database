import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './routes';
import { Store } from './store';
import { Auth } from './auth';
import { App } from './app';
import { beforeEach, afterEach, it, expect } from 'vitest';
let http: HttpTestingController;
beforeEach(() => {TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)]}); http = TestBed.inject(HttpTestingController);});
afterEach(() => http.verify());
it('opens Home, product catalog, suppliers and orders without a login redirect', async () => {
  const harness = await RouterTestingHarness.create();
  for (const url of ['/', '/products', '/suppliers', '/orders']) {
    await harness.navigateByUrl(url);
    if (url === '/products') {
      http.expectOne(request => request.url === '/api/catalog/products/').flush({count: 0, next: null, previous: null, results: []});
      http.expectOne('/api/catalog/categories/').flush({results: []});
    }
    if (url === '/suppliers') http.expectOne('/api/catalog/suppliers/?page=1').flush({count:1,next:null,previous:null,results:[{supplier_id:3,supplier_name:'Public supplier'}]});
    if (url === '/orders') http.expectOne('/api/catalog/orders/?page=1').flush({count:1,next:null,previous:null,results:[{order_id:9,supplier_name:'Public supplier',order_date:'2026-11-01',expected_delivery_date:null,status:'Pending',items:[{product_id:2,product_name:'Public item',quantity:2}]}]});
    expect(harness.routeNativeElement?.querySelector('h1')).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).not.toContain('Password');
  }
  http.expectNone(request => request.url.startsWith('/api/'));
});
it('never renders cached private records or metrics to anonymous visitors', async () => {
  const store = TestBed.inject(Store); await store.useDemo();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/suppliers');
  http.expectOne('/api/catalog/suppliers/?page=1').flush({count:1,next:null,previous:null,results:[{supplier_id:1,supplier_name:'Public supplier'}]});
  for (const supplier of store.suppliers()) expect(harness.routeNativeElement?.textContent).not.toContain(supplier.email);
  await harness.navigateByUrl('/');
  expect(harness.routeNativeElement?.querySelector('[aria-label="Overview"]')).toBeNull();
  expect(harness.routeNativeElement?.querySelector('[aria-label="Purchasing metrics"]')).toBeNull();
});
it('shows the safe catalog to a signed-in security role without loading private records', async () => {
  TestBed.inject(Auth).user.set({username: 'security', name: 'Security', email: 's@example.test', role: 'Security Administrator', capabilities: {read: false}});
  const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/products');
  http.expectOne(request => request.url === '/api/catalog/products/').flush({count: 0, next: null, previous: null, results: []});
  http.expectOne('/api/catalog/categories/').flush({results: []});
  harness.detectChanges();
  expect(harness.routeNativeElement?.textContent).toContain('Product names and categories are public');
  http.expectNone(request => request.url.startsWith('/api/'));
});
it('hides analytics and Jedel AI links from guests and shows them to User roles', async () => {
  const fixture=TestBed.createComponent(App);
  http.expectOne('/api/auth/me/').flush({}, {status:401,statusText:'Unauthorized'});
  await fixture.whenStable();
  const guestLinks=[...fixture.nativeElement.querySelectorAll('header nav a')].map((link:HTMLAnchorElement)=>link.textContent?.trim());
  expect(guestLinks).not.toContain('Analytics');expect(guestLinks).not.toContain('Jedel AI');
  const links=[{path:'/',label:'Home'},{path:'/analytics',label:'Analytics'},{path:'/ai-assistant',label:'Jedel AI'}];
  const simulated={auth:{user:()=>({capabilities:{read:true}})},links} as unknown as App;
  expect(App.prototype.visibleLinks.call(simulated).map(link=>link.label)).toContain('Analytics');
  expect(App.prototype.visibleLinks.call(simulated).map(link=>link.label)).toContain('Jedel AI');
});
