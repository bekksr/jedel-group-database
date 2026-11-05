import { FieldAccessibility } from '../../shared/ui/field-accessibility';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkspaceDataService } from '../../core/data/workspace-data.service';
import { FormsModule } from '@angular/forms';
import { ERP_DATA } from '../../core/data/models';
import { Icon } from '../../shared/ui/icon';
import { FieldError } from '../../shared/ui/field-error';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FieldAccessibility, FormsModule, ReactiveFormsModule, Icon, FieldError, ConfirmDialog],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly data = inject(ERP_DATA);
  readonly workspace = this.data instanceof WorkspaceDataService ? this.data : null;
  token = '';
  readonly connecting = signal(false);
  readonly modeConfirm = signal(false);
  async connect(): Promise<void> {
    if (!this.workspace || this.connecting()) return;
    this.connecting.set(true);
    this.error.set('');
    const token = this.token;
    this.token = '';
    try {
      await this.workspace.connect(token);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.connecting.set(false);
    }
  }
  disconnect(): void {
    this.workspace?.disconnect();
    this.token = '';
    this.error.set('');
  }
  async enableDemo(): Promise<void> {
    try {
      await this.workspace?.useDemo();
      this.modeConfirm.set(false);
      this.error.set('');
      this.form.reset({ threshold: this.data.lowStockThreshold() });
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  enableApi(): void {
    try {
      this.workspace?.useApi();
      this.error.set('');
      this.form.reset({ threshold: this.data.lowStockThreshold() });
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  readonly resetOpen = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly form = inject(NonNullableFormBuilder).group({
    threshold: [
      this.data.lowStockThreshold(),
      [
        Validators.required,
        Validators.min(0),
        Validators.max(2147483647),
        Validators.pattern(/^\d+$/),
      ],
    ],
  });
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.saved.set(false);
    this.error.set('');
    if (this.form.invalid) return;
    try {
      await this.data.setLowStockThreshold(this.form.getRawValue().threshold);
      this.saved.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  reset(): void {
    this.data.reset();
    this.form.reset({ threshold: this.data.lowStockThreshold() });
    this.saved.set(false);
    this.resetOpen.set(false);
  }
}
