import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth, accountGuard, businessGuard, capabilityGuard, safeReturnTo } from './auth';
import { beforeEach, afterEach, it, expect } from 'vitest';
const user = {username: 'employee', name: 'Employee', email: 'e@example.test', role: 'Purchasing Employee', capabilities: {read: true}};
let auth: Auth; let http: HttpTestingController;
beforeEach(() => {
  TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]});
  auth = TestBed.inject(Auth); http = TestBed.inject(HttpTestingController);
});
afterEach(() => http.verify());
it('restores and shares a server session across guard requests', async () => {
  const a = auth.restore(); const b = auth.restore();
  http.expectOne('/api/auth/me/').flush(user);
  expect(await a).toBe(true); expect(await b).toBe(true); expect(auth.user()).toEqual(user);
});
it('redirects expired sessions to login', async () => {
  const result = TestBed.runInInjectionContext(() => accountGuard({} as never, {} as never));
  http.expectOne('/api/auth/me/').flush({}, {status: 401, statusText: 'Unauthorized'});
  expect(TestBed.inject(Router).serializeUrl(await result as never)).toBe('/auth?mode=login');
});
it('denies business navigation to security administrators', async () => {
  auth.user.set({...user, role: 'Security Administrator', capabilities: {read: false}});
  const result = await TestBed.runInInjectionContext(() => businessGuard({} as never, {} as never));
  expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/access-denied');
});
it('gets CSRF before login and clears state only after server logout', async () => {
  const pending = auth.login('employee', 'private');
  http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve, 0));
  const login = http.expectOne('/api/auth/login/'); expect(login.request.body.identifier).toBe('employee'); login.flush(user);
  await pending; expect(auth.user()).toEqual(user);
  const logout = auth.logout(); http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve, 0));
  expect(auth.user()).toEqual(user); http.expectOne('/api/auth/logout/').flush({}); await logout;
  expect(auth.user()).toBeNull();
});
it('propagates invalid credentials without establishing a client session', async () => {
  const pending = auth.login('wrong', 'wrong');
  const assertion = expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
  http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve, 0));
  http.expectOne('/api/auth/login/').flush({detail: 'Invalid credentials'}, {status: 400, statusText: 'Bad Request'});
  await assertion; expect(auth.user()).toBeNull();
});

it('sends anonymous protected actions to login with the intended operation', async () => {
  const result = TestBed.runInInjectionContext(() => capabilityGuard({data: {capability: 'manage_catalog'}} as never, {url: '/products/new'} as never));
  http.expectOne('/api/auth/me/').flush({}, {status: 401, statusText: 'Unauthorized'});
  expect(TestBed.inject(Router).serializeUrl(await result as never)).toBe('/auth?mode=login&returnTo=%2Fproducts%2Fnew');
});
it('denies signed-in viewers instead of asking them to log in again', async () => {
  auth.user.set(user);
  const result = await TestBed.runInInjectionContext(() => capabilityGuard({data: {capability: 'manage_catalog'}} as never, {url: '/products/new'} as never));
  expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/access-denied');
});
it('rejects external and recursive login return URLs', () => {
  for (const target of ['https://example.test', '//example.test', '/login?returnTo=/orders', '/register']) expect(safeReturnTo(target)).toBe('/');
  expect(safeReturnTo('/products/new')).toBe('/products/new');
});

it('does not overwrite an automatically logged-in account with a late anonymous restore response', async () => {
  const restoring = auth.restore(); const old = http.expectOne('/api/auth/me/');
  const registering = auth.register({name: 'New User', email: 'new@example.test', password: 'Valid-password-931!'});
  http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve,0));
  http.expectOne('/api/auth/register/').flush({detail: 'Created'}, {status: 201,statusText: 'Created'});
  await new Promise(resolve => setTimeout(resolve,0));
  const basic = {...user, role: 'Basic User', capabilities: {read: false}};
  http.expectOne('/api/auth/me/').flush(basic); await registering;
  old.flush({}, {status: 401,statusText: 'Unauthorized'}); await restoring;
  expect(auth.user()).toEqual(basic);
});
