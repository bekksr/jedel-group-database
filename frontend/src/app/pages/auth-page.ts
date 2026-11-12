import { Notifications } from '../core/data/notifications.service';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth, safeReturnTo } from '../auth';
import { apiError } from '../core/data/api-errors';
type Field = 'name' | 'email' | 'password' | 'confirm';
@Component({imports: [ReactiveFormsModule, RouterLink], templateUrl: './auth-page.html', styleUrl: './auth-page.scss'})
export class AuthPage {
  readonly auth = inject(Auth);
  private readonly notices = inject(Notifications);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly mode = signal<'login' | 'register'>('login');
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  readonly form = this.fb.group({name: [''], email: [''], password: [''], confirm: ['']});
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {
      const mode = params.get('mode') === 'register' || this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login';
      this.setMode(mode);
    });
  }
  setMode(mode: 'login' | 'register') {
    this.mode.set(mode); this.error.set(''); this.serverErrors.set({}); this.success.set(false);
    const register = mode === 'register';
    this.form.controls.name.setValidators(register ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)] : []);
    this.form.controls.email.setValidators(register ? [Validators.required, Validators.email, Validators.maxLength(150)] : [Validators.required, Validators.maxLength(254)]);
    this.form.controls.password.setValidators([Validators.required, Validators.maxLength(128), ...(register ? [Validators.minLength(8)] : [])]);
    this.form.controls.confirm.setValidators(register ? [Validators.required] : []);
    for (const control of Object.values(this.form.controls)) { control.updateValueAndValidity({emitEvent: false}); control.markAsUntouched(); }
  }
  async switchMode(mode: 'login' | 'register') {
    if (this.busy()) return;
    this.setMode(mode);
    await this.router.navigate(['/auth'], {queryParams: {mode, returnTo: this.route.snapshot.queryParamMap.get('returnTo') ?? undefined}, replaceUrl: true});
  }
  fieldError(field: Field): string {
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.controls[field];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) return 'Use at least 8 characters.';
    if (control.hasError('maxlength')) return 'This value is too long.';
    if (control.hasError('pattern')) return 'Enter your full name.';
    if (field === 'confirm' && this.mode() === 'register' && control.value !== this.form.controls.password.value) return 'Passwords do not match.';
    return '';
  }
  clearFieldError(field: Field) {
    this.serverErrors.update(errors => ({...errors, [field]: undefined}));
    this.error.set(''); this.success.set(false);
  }
  async submit() {
    if (this.busy()) return;
    this.error.set(''); this.serverErrors.set({}); this.success.set(false); this.form.markAllAsTouched();
    if (this.form.invalid || this.fieldError('confirm')) return;
    this.busy.set(true);
    const value = this.form.getRawValue();
    try {
      if (this.mode() === 'register') {
        await this.auth.register({name: value.name, email: value.email, password: value.password, password_confirm: value.confirm});
        this.success.set(true);
        this.form.controls.password.reset(); this.form.controls.confirm.reset();
        this.notices.show('success', 'Account created successfully. Welcome to Jedel.Group!');
        await this.router.navigateByUrl('/');
      } else {
        await this.auth.login(value.email, value.password);
        this.form.controls.password.reset();
        await this.router.navigateByUrl(safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo')));
      }
    } catch (error) {
      const fields: Partial<Record<Field, string>> = {};
      if (error instanceof HttpErrorResponse && error.status === 400 && error.error && typeof error.error === 'object') {
        const mapping: Record<string, Field> = {name: 'name', email: 'email', identifier: 'email', username: 'email', password: 'password', password_confirm: 'confirm'};
        for (const [key, messages] of Object.entries(error.error)) {
          const field = mapping[key];
          if (field) fields[field] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        }
      }
      this.serverErrors.set(fields);
      if (!Object.keys(fields).length) this.error.set(apiError(error));
    } finally { this.busy.set(false); }
  }
}
