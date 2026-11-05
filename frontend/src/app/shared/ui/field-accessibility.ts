import { Directive, inject } from '@angular/core';
import { AbstractControl, NgControl, Validators } from '@angular/forms';
const ids = new WeakMap<AbstractControl, string>();
let nextId = 0;
export function controlErrorId(control: AbstractControl): string {
  if (!ids.has(control)) ids.set(control, `field-error-${++nextId}`);
  return ids.get(control)!;
}
@Directive({
  selector: 'input[formControlName], select[formControlName]',
  standalone: true,
  host: {
    '[attr.aria-invalid]': 'invalid',
    '[attr.aria-describedby]': 'description',
    '[attr.aria-required]': 'required',
  },
})
export class FieldAccessibility {
  private readonly directive = inject(NgControl, { self: true });
  get invalid(): string | null {
    const c = this.directive.control;
    return c?.invalid && c.touched ? 'true' : null;
  }
  get description(): string | null {
    const c = this.directive.control;
    return c?.invalid && c.touched ? controlErrorId(c) : null;
  }
  get required(): string | null {
    return this.directive.control?.hasValidator(Validators.required) ? 'true' : null;
  }
}
