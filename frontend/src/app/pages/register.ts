import { Component, inject, signal } from "@angular/core";
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
@Component({
  imports: [ReactiveFormsModule],
  template: `<h1>Registration</h1>
    <p class="subtitle">Create your purchasing account.</p>
    <section class="panel narrow">
      <p class="note">
        Form preview only. Accounts will be created after backend integration.
        Use test details.
      </p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label
          >Full name<input
            formControlName="name"
            autocomplete="name"
            maxlength="100"
            required
        /></label>
        <label
          >Email<input
            type="email"
            formControlName="email"
            autocomplete="email"
            maxlength="100"
            required
        /></label>
        <label
          >Password<input
            type="password"
            formControlName="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="128"
            required
        /></label>
        <p class="hint">Use at least 8 characters.</p>
        <label
          >Confirm password<input
            type="password"
            formControlName="confirm"
            autocomplete="new-password"
            maxlength="128"
            required
        /></label>
        @if (error()) {
          <p role="alert" class="error">{{ error() }}</p>
        }
        <button type="submit">Check registration</button>
      </form>
      @if (success()) {
        <p role="status" class="note">
          Form validated. No account was created. Password fields have been
          cleared.
        </p>
      }
    </section>`,
})
export class RegisterPage {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    name: [
      "",
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(100),
      ],
    ],
    email: [
      "",
      [Validators.required, Validators.email, Validators.maxLength(100)],
    ],
    password: [
      "",
      [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    ],
    confirm: ["", Validators.required],
  });
  readonly error = signal("");
  readonly success = signal(false);
  submit() {
    this.success.set(false);
    this.error.set("");
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        "Enter a name, a valid email and a password of at least 8 characters.",
      );
      return;
    }
    const v = this.form.getRawValue();
    if (v.password !== v.confirm) {
      this.error.set("Passwords do not match.");
      return;
    }
    this.form.controls.password.reset();
    this.form.controls.confirm.reset();
    this.success.set(true);
  }
}
