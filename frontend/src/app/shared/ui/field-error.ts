import { controlErrorId } from './field-accessibility';
import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
@Component({
  selector: 'app-field-error',
  standalone: true,
  host: { '[attr.id]': 'errorId' },
  template: `@if (control().touched && control().invalid) {
    <small class="field-error">{{ message() }}</small>
  }`,
})
export class FieldError {
  get errorId(): string {
    return controlErrorId(this.control());
  }
  readonly control = input.required<AbstractControl>();
  message(): string {
    const e = this.control().errors;
    if (e?.['required']) return 'This field is required.';
    if (e?.['email']) return 'Enter a valid email address.';
    if (e?.['maxlength']) return `Use no more than ${e['maxlength'].requiredLength} characters.`;
    if (e?.['min']) return `Minimum value is ${e['min'].min}.`;
    if (e?.['max']) return `Maximum value is ${e['max'].max}.`;
    if (e?.['pattern']) return 'Enter a valid value using the required format.';
    return 'Check this value.';
  }
}
