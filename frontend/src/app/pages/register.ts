import { Component, inject, signal } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { DemoRegistrationService } from "../core/data/demo-registration.service";

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>Registration</h1>
    <p class="subtitle">Create a sample profile for this session. Use test details.</p>
    <section class="panel registration-panel">
      @let nameInvalid = fields.name.touched && fields.name.invalid;
      @let emailInvalid = fields.email.touched && fields.email.invalid;
      @let passwordInvalid = fields.password.touched && fields.password.invalid;
      @let confirmationInvalid = fields.confirm.touched && (fields.confirm.invalid || form.hasError("passwordMismatch"));

      <form [formGroup]="form" (ngSubmit)="submit()" (input)="success.set(false)">
        <div class="registration-grid">
          <div class="field">
            <label for="registration-name">Full name</label>
            <input id="registration-name" formControlName="name" autocomplete="name" maxlength="100"
              [attr.aria-invalid]="nameInvalid" [attr.aria-describedby]="nameInvalid ? 'name-error' : null" required />
            @if (nameInvalid) {
              <p class="field-error" id="name-error">Enter your name (up to 100 characters).</p>
            }
          </div>
          <div class="field">
            <label for="registration-email">Email address</label>
            <input id="registration-email" type="email" formControlName="email" autocomplete="email" maxlength="100"
              [attr.aria-invalid]="emailInvalid" [attr.aria-describedby]="emailInvalid ? 'email-error' : null" required />
            @if (emailInvalid) {
              <p class="field-error" id="email-error">
                {{ fields.email.hasError("duplicate") ? "This email is already registered in this session." : "Enter a valid email address (up to 100 characters)." }}
              </p>
            }
          </div>
          <div class="field">
            <label for="registration-password">Password</label>
            <input id="registration-password" type="password" formControlName="password" autocomplete="new-password"
              minlength="8" maxlength="128" [attr.aria-invalid]="passwordInvalid" aria-describedby="password-hint" required />
            <p id="password-hint" [class]="passwordInvalid ? 'field-error' : 'hint'">Use 8–128 characters.</p>
          </div>
          <div class="field">
            <label for="registration-confirm">Confirm password</label>
            <input id="registration-confirm" type="password" formControlName="confirm" autocomplete="new-password" maxlength="128"
              [attr.aria-invalid]="confirmationInvalid" [attr.aria-describedby]="confirmationInvalid ? 'confirm-error' : null" required />
            @if (confirmationInvalid) {
              <p class="field-error" id="confirm-error">
                {{ fields.confirm.hasError("required") ? "Confirm your password." : "Passwords do not match." }}
              </p>
            }
          </div>
        </div>
        <div class="actions">
          <button type="submit">Register in demo</button>
          <a class="button secondary" routerLink="/">Back to workspace</a>
        </div>
      </form>
      @if (submittedInvalid()) {
        <p class="field-error form-feedback" role="alert">Check the highlighted fields.</p>
      }
      @if (success()) {
        <p class="note form-feedback" role="status">Sample profile created for this session. Password fields were cleared.</p>
      }
    </section>
  `,
})
export class RegisterPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly registration = inject(DemoRegistrationService);
  readonly form = this.fb.group(
    {
      name: ["", [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
      email: ["", [Validators.required, Validators.email, Validators.maxLength(100)]],
      password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirm: ["", Validators.required],
    },
    {
      validators: (form) =>
        form.value.confirm && form.value.password !== form.value.confirm ? { passwordMismatch: true } : null,
    },
  );
  readonly fields = this.form.controls;
  readonly success = signal(false);
  readonly submittedInvalid = signal(false);

  submit(): void {
    this.success.set(false);
    const name = this.fields.name.value.trim();
    const email = this.fields.email.value.trim().toLowerCase();
    this.form.patchValue({ name, email });
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.submittedInvalid.set(true);
      return;
    }
    if (!this.registration.register(name, email)) {
      this.fields.email.setErrors({ duplicate: true });
      this.submittedInvalid.set(true);
      return;
    }
    this.form.reset();
    this.submittedInvalid.set(false);
    this.success.set(true);
  }
}
