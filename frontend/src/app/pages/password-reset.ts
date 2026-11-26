import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../auth';
import { apiError } from '../core/data/api-errors';
import { UiLanguage } from '../core/ui-language';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="auth-shell"><div class="auth-card"><a class="auth-brand" routerLink="/">Jedel<span>.</span>Group</a><h1>{{ text('Forgot password?') }}</h1><p class="auth-intro">{{ text('Enter your account email. If it matches an account, we will send reset instructions.') }}</p>
    @if(sent()) {<p class="auth-success" role="status">{{ text('If an account matches that email address, password reset instructions will be sent.') }}</p>}
    @if(error()) {<p class="auth-error" role="alert">{{ text(error()) }}</p>}
    <form [formGroup]="form" (ngSubmit)="submit()"><label for="reset-email">{{ text('Email address') }}</label><input id="reset-email" type="email" formControlName="email" autocomplete="email" maxlength="254" required><button class="auth-submit" type="submit" [disabled]="busy()">{{ text(busy() ? 'Please wait...' : 'Send reset link') }}</button></form><a class="back-home" routerLink="/auth?mode=login">{{ text('Back to log in') }}</a></div></section>`,
  styles: [`.auth-shell{display:flex;justify-content:center;padding:32px 16px 56px}.auth-card{width:100%;max-width:460px;padding:36px;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 60px #23375a0c}.auth-brand{display:block;text-align:center;text-decoration:none;font-size:28px;font-weight:800;color:var(--text);margin-bottom:28px}.auth-brand span{color:var(--accent)}h1{font-size:26px}.auth-intro{color:var(--muted)}label{display:block;margin:18px 0 6px;font-size:14px;font-weight:650}input{width:100%;min-height:44px;padding:11px 12px;border:1px solid var(--input-line);border-radius:8px;background:var(--surface);color:var(--text)}.auth-submit{display:block;width:100%;margin-top:20px;padding:12px;border-radius:8px}.auth-error,.auth-success{padding:12px 14px;border-radius:8px;font-size:13px}.auth-error{background:var(--error-bg);color:var(--error)}.auth-success{background:var(--tint);color:var(--accent)}.back-home{display:block;text-align:center;margin-top:22px;font-size:13px}`]
})
export class PasswordResetRequestPage {
  readonly text = inject(UiLanguage).text;
  private readonly auth = inject(Auth);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]]});
  readonly busy = signal(false); readonly sent = signal(false); readonly error = signal('');
  async submit() {
    if (this.busy()) return;
    this.sent.set(false); this.error.set(''); this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.auth.csrf();
      await firstValueFrom(this.http.post(this.auth.base + 'password-reset/', this.form.getRawValue()));
      this.sent.set(true);
    } catch (error) { this.error.set(apiError(error)); }
    finally { this.busy.set(false); }
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="auth-shell"><div class="auth-card"><a class="auth-brand" routerLink="/">Jedel<span>.</span>Group</a><h1>{{ text('Choose a new password') }}</h1><p class="auth-intro">{{ text('Use a strong password you have not used before.') }}</p>
    @if(error()) {<p class="auth-error" role="alert">{{ text(error()) }}</p>}
    <form [formGroup]="form" (ngSubmit)="submit()"><label for="new-password">{{ text('New password') }}</label><input id="new-password" type="password" formControlName="password" autocomplete="new-password" maxlength="128" required><label for="confirm-password">{{ text('Confirm new password') }}</label><input id="confirm-password" type="password" formControlName="confirm" autocomplete="new-password" maxlength="128" required><button class="auth-submit" type="submit" [disabled]="busy()">{{ text(busy() ? 'Please wait...' : 'Reset password') }}</button></form></div></section>`,
  styles: [`.auth-shell{display:flex;justify-content:center;padding:32px 16px 56px}.auth-card{width:100%;max-width:460px;padding:36px;background:var(--surface);border:1px solid var(--line);border-radius:18px}.auth-brand{display:block;text-align:center;text-decoration:none;font-size:28px;font-weight:800;color:var(--text);margin-bottom:28px}.auth-brand span{color:var(--accent)}h1{font-size:26px}.auth-intro{color:var(--muted)}label{display:block;margin:18px 0 6px;font-size:14px;font-weight:650}input{width:100%;min-height:44px;padding:11px 12px;border:1px solid var(--input-line);border-radius:8px;background:var(--surface);color:var(--text)}.auth-submit{display:block;width:100%;margin-top:20px;padding:12px;border-radius:8px}.auth-error{padding:12px 14px;border-radius:8px;font-size:13px;background:var(--error-bg);color:var(--error)}`]
})
export class PasswordResetConfirmPage {
  readonly text = inject(UiLanguage).text;
  private readonly auth = inject(Auth); private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  readonly form = this.fb.group({password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]], confirm: ['', [Validators.required, Validators.maxLength(128)]]});
  readonly busy = signal(false); readonly error = signal('');
  async submit() {
    if (this.busy()) return;
    this.error.set(''); this.form.markAllAsTouched();
    const {password, confirm} = this.form.getRawValue();
    if (this.form.invalid) { this.error.set('Enter a valid password of at least 8 characters.'); return; }
    if (password !== confirm) { this.error.set('New password and confirmation must match.'); return; }
    this.busy.set(true);
    try {
      await this.auth.csrf();
      const params = this.route.snapshot.paramMap;
      await firstValueFrom(this.http.post(this.auth.base + 'password-reset/confirm/', {uid: params.get('uid'), token: params.get('token'), new_password: password, new_password_confirm: confirm}));
      await this.router.navigate(['/auth'], {queryParams: {mode: 'login', passwordReset: 'success'}});
    } catch (error) { this.error.set(apiError(error)); }
    finally { this.busy.set(false); }
  }
}
