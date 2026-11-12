import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './routes';
import { Store } from './store';
import { Auth } from './auth';
import { beforeEach, afterEach, it, expect } from 'vitest';
let http: HttpTestingController;
beforeEach(() => {TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)]}); http = TestBed.inject(HttpTestingController);});
afterEach(() => http.verify());
it('opens Home and every public section without a login redirect or business API request', async () => {
  const harness = await RouterTestingHarness.create();
  for (const url of ['/', '/products', '/suppliers', '/orders', '/analytics']) {
    await harness.navigateByUrl(url);
    if (url === '/products') {
      http.expectOne(request => request.url === '/api/catalog/products/').flush({count: 0, next: null, previous: null, results: []});
      http.expectOne('/api/catalog/categories/').flush({results: []});
    }
    expect(harness.routeNativeElement?.querySelector('h1')).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).not.toContain('Password');
  }
  http.expectNone(request => request.url.startsWith('/api/'));
});
it('never renders cached private records or metrics to anonymous visitors', async () => {
  const store = TestBed.inject(Store); await store.useDemo();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/suppliers');
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
