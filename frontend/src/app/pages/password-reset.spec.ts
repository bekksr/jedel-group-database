import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { routes } from '../routes';
import { PasswordResetConfirmPage, PasswordResetRequestPage } from './password-reset';

let http: HttpTestingController;
beforeEach(() => { TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)]}); http = TestBed.inject(HttpTestingController); });
afterEach(() => http.verify());

it('requests reset with the email and shows only a generic acknowledgement', async () => {
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/password-reset', PasswordResetRequestPage);
  page.form.controls.email.setValue('someone@example.test');
  const pending = page.submit();
  http.expectOne('/api/auth/csrf/').flush({});
  await new Promise(resolve => setTimeout(resolve, 0));
  const request = http.expectOne('/api/auth/password-reset/');
  expect(request.request.body).toEqual({email: 'someone@example.test'});
  request.flush({detail: 'If an account matches that email address, password reset instructions will be sent.'});
  await pending;
  harness.detectChanges();
  expect(page.sent()).toBe(true);
  expect(harness.routeNativeElement?.textContent).toContain('If an account matches that email address');
});

it('submits token and matching passwords then redirects to login with success feedback', async () => {
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/password-reset/confirm/dGVzdA/token-value', PasswordResetConfirmPage);
  page.form.setValue({password: 'Reset-secure-password-847!xyz', confirm: 'Reset-secure-password-847!xyz'});
  const pending = page.submit();
  http.expectOne('/api/auth/csrf/').flush({});
  await new Promise(resolve => setTimeout(resolve, 0));
  const request = http.expectOne('/api/auth/password-reset/confirm/');
  expect(request.request.body).toEqual({uid: 'dGVzdA', token: 'token-value', new_password: 'Reset-secure-password-847!xyz', new_password_confirm: 'Reset-secure-password-847!xyz'});
  request.flush({detail: 'Password reset successfully.'});
  await pending;
  expect(TestBed.inject(Router).url).toContain('/auth?mode=login&passwordReset=success');
});

it('does not send the reset token when confirmation does not match', async () => {
  const {page} = await (async () => { const harness = await RouterTestingHarness.create(); return {page: await harness.navigateByUrl('/password-reset/confirm/dGVzdA/token-value', PasswordResetConfirmPage)}; })();
  page.form.setValue({password: 'Reset-secure-password-847!xyz', confirm: 'different'});
  await page.submit();
  expect(page.error()).toContain('must match');
  http.expectNone(request => request.url.startsWith('/api/'));
});
