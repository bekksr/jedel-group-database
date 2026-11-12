import { Notifications } from '../core/data/notifications.service';
import { Auth } from '../auth';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../routes';
import { AuthPage } from './auth-page';
import { beforeEach, afterEach, it, expect } from 'vitest';
let http: HttpTestingController;
beforeEach(() => {TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)]}); http = TestBed.inject(HttpTestingController);});
afterEach(() => http.verify());
async function screen(url = '/auth') { const harness = await RouterTestingHarness.create(); const page = await harness.navigateByUrl(url, AuthPage); return {harness, page}; }
it('renders one card with login/register modes and preserves identifier when switching', async () => {
  const {harness, page} = await screen(); expect(harness.routeNativeElement?.textContent).toContain('Welcome back');
  page.form.controls.email.setValue('member@example.test'); await page.switchMode('register');
  expect(page.mode()).toBe('register'); expect(page.form.controls.email.value).toBe('member@example.test');
  harness.detectChanges(); expect(harness.routeNativeElement?.textContent).toContain('Create an account');
  expect(harness.routeNativeElement?.querySelectorAll('form').length).toBe(1);
  await page.switchMode('login'); expect(page.mode()).toBe('login');
});
it('keeps bookmarked login/register routes and safe return destinations functional', async () => {
  const harness = await RouterTestingHarness.create();
  for (const [url, mode] of [['/login?returnTo=%2Forders%2Fnew','login'], ['/register','register'], ['/auth?mode=register','register']]) {
    const page = await harness.navigateByUrl(url, AuthPage); expect(page.mode()).toBe(mode); expect(TestBed.inject(Router).url).toContain('/auth?mode=');
  }
});
it('shows adjacent field errors and rejects invalid confirmation before any HTTP request', async () => {
  const {page} = await screen('/auth?mode=register');
  page.form.setValue({name: 'Member', email: 'invalid', password: 'short', confirm: 'different'}); await page.submit();
  expect(page.fieldError('email')).toContain('valid email'); expect(page.fieldError('password')).toContain('8 characters'); expect(page.fieldError('confirm')).toContain('match');
  expect(page.error()).toBe(''); http.expectNone(request => request.url.startsWith('/api/'));
});
it('submits once, loads the authenticated profile and redirects Home only after real confirmation', async () => {
  const {harness, page} = await screen('/auth?mode=register');
  page.form.setValue({name: 'Member', email: 'member@example.test', password: 'Secure-test-password-928!', confirm: 'Secure-test-password-928!'});
  const pending = page.submit(); await page.submit(); expect(page.success()).toBe(false); expect(page.busy()).toBe(true);
  http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve,0));
  const request = http.expectOne('/api/auth/register/'); expect(request.request.body.password_confirm).toBe('Secure-test-password-928!'); expect(request.request.body.is_staff).toBeUndefined();
  request.flush({detail: 'Account created successfully. Welcome to Jedel.Group!'}, {status: 201, statusText: 'Created'});
  await new Promise(resolve => setTimeout(resolve,0));
  const profile = {username: 'member@example.test', name: 'Member', email: 'member@example.test', role: 'Basic User', capabilities: {read: false}};
  http.expectOne('/api/auth/me/').flush(profile); await pending;
  expect(TestBed.inject(Auth).user()).toEqual(profile); expect(TestBed.inject(Router).url).toBe('/');
  expect(TestBed.inject(Notifications).messages().at(-1)?.message).toBe('Account created successfully. Welcome to Jedel.Group!');
  expect(page.form.controls.email.value).toBe('member@example.test'); expect(page.form.controls.password.value).toBe('');
});
it('retains valid input on field validation failure without duplicating the error', async () => {
  const {page} = await screen('/auth?mode=register');
  page.form.setValue({name: 'Member', email: 'member@example.test', password: 'Secure-test-password-928!', confirm: 'Secure-test-password-928!'});
  const pending = page.submit(); http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve,0));
  http.expectOne('/api/auth/register/').flush({email: ['Account already exists.']}, {status: 400,statusText: 'Bad Request'}); await pending;
  expect(page.fieldError('email')).toBe('Account already exists.'); expect(page.error()).toBe(''); expect(page.success()).toBe(false);
  expect(page.form.controls.password.value).toBe('Secure-test-password-928!');
});
it('provides an accessible password visibility toggle', async () => {
  const {harness} = await screen();
  const toggle = harness.routeNativeElement?.querySelector('[aria-label="Show password"]') as HTMLButtonElement;
  expect(harness.routeNativeElement?.querySelector('#auth-password')?.getAttribute('type')).toBe('password');
  toggle.click(); harness.detectChanges(); expect(harness.routeNativeElement?.querySelector('#auth-password')?.getAttribute('type')).toBe('text');
  expect(toggle.getAttribute('aria-label')).toBe('Hide password');
});

it('does not announce success or redirect when authenticated profile retrieval fails after registration', async () => {
  const {page} = await screen('/auth?mode=register');
  page.form.setValue({name: 'Member', email: 'member@example.test', password: 'Secure-test-password-928!', confirm: 'Secure-test-password-928!'});
  const pending = page.submit(); http.expectOne('/api/auth/csrf/').flush({}); await new Promise(resolve => setTimeout(resolve,0));
  http.expectOne('/api/auth/register/').flush({detail: 'Account created successfully.'}, {status: 201,statusText: 'Created'});
  await new Promise(resolve => setTimeout(resolve,0));
  http.expectOne('/api/auth/me/').flush({}, {status: 503,statusText: 'Service Unavailable'}); await pending;
  expect(page.success()).toBe(false); expect(page.error()).toBeTruthy();
  expect(TestBed.inject(Notifications).messages()).toEqual([]);
  expect(TestBed.inject(Router).url).toContain('/auth?mode=register');
});
