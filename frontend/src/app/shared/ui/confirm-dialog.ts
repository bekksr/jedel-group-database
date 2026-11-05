import { ERP_DATA } from '../../core/data/models';
import { Component, inject, input, output } from '@angular/core';
import { Modal } from './modal';
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [Modal],
  template: ` <app-modal [busy]="busy()" [title]="title()" (dismiss)="cancel.emit()"
    ><p class="confirmation-message">{{ message() }}</p>
    @if (error()) {
      <p class="error-banner" role="alert">{{ error() }}</p>
    }
    <p class="form-hint">
      {{
        data.mode === 'demo'
          ? 'Demo mode - changes affect this session only.'
          : 'API mode - the server must confirm this operation.'
      }}
    </p>
    <div class="form-actions">
      <button [disabled]="busy()" type="button" class="button secondary" (click)="cancel.emit()">
        Go back</button
      ><button
        [disabled]="busy()"
        type="button"
        class="button"
        [class.danger]="danger()"
        (click)="confirm.emit()"
      >
        {{ action() }}
      </button>
    </div></app-modal
  >`,
})
export class ConfirmDialog {
  readonly data = inject(ERP_DATA);
  readonly busy = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly action = input('Confirm');
  readonly danger = input(false);
  readonly error = input('');
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
