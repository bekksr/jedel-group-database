import { FieldAccessibility } from '../../shared/ui/field-accessibility';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ERP_DATA, Supplier } from '../../core/data/models';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { FieldError } from '../../shared/ui/field-error';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Pagination } from '../../shared/ui/pagination';
import { DataState } from '../../shared/ui/data-state';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [
    FieldAccessibility,
    FormsModule,
    ReactiveFormsModule,
    Icon,
    Modal,
    FieldError,
    ConfirmDialog,
    Pagination,
    DataState,
  ],
  templateUrl: './suppliers.page.html',
})
export class SuppliersPage {
  readonly data = inject(ERP_DATA);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly query = signal('');
  readonly page = signal(1);
  readonly sort = signal<'supplier_name' | 'email' | 'address'>('supplier_name');
  readonly direction = signal(1);
  readonly editing = signal<Supplier | null>(null);
  readonly formOpen = signal(false);
  readonly deleting = signal<Supplier | null>(null);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly form = this.fb.group({
    supplier_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    phone: ['', Validators.maxLength(20)],
    address: ['', Validators.maxLength(255)],
  });
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.data
      .suppliers()
      .filter((s) =>
        [s.supplier_name, s.email, s.phone, s.address].some((v) => v.toLowerCase().includes(q)),
      )
      .slice()
      .sort((a, b) => a[this.sort()].localeCompare(b[this.sort()]) * this.direction());
  });
  readonly currentPage = computed(() =>
    Math.min(this.page(), Math.max(1, Math.ceil(this.filtered().length / 5))),
  );
  readonly rows = computed(() =>
    this.filtered().slice((this.currentPage() - 1) * 5, this.currentPage() * 5),
  );
  constructor() {
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('action') === 'new') this.open();
  }
  search(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  sortBy(key: 'supplier_name' | 'email' | 'address'): void {
    this.direction.set(this.sort() === key ? -this.direction() : 1);
    this.sort.set(key);
    this.page.set(1);
  }
  open(supplier?: Supplier): void {
    if (this.data.permissions?.()?.manageCatalog === false || this.data.canWrite?.() === false) {
      this.error.set('Connect with write access in Settings first.');
      return;
    }
    this.editing.set(supplier ?? null);
    this.form.reset(supplier ?? { supplier_name: '', email: '', phone: '', address: '' });
    this.error.set('');
    this.formOpen.set(true);
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveSupplier(this.form.getRawValue(), this.editing()?.supplier_id);
      this.formOpen.set(false);
      this.page.set(1);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  askDelete(supplier: Supplier): void {
    this.error.set('');
    this.deleting.set(supplier);
  }
  async remove(): Promise<void> {
    const s = this.deleting();
    if (!s || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.deleteSupplier(s.supplier_id);
      this.deleting.set(null);
      this.page.set(1);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
