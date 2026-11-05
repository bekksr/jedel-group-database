import { FieldAccessibility } from '../../shared/ui/field-accessibility';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ERP_DATA, Product } from '../../core/data/models';
import { KztPipe } from '../../shared/pipes/kzt.pipe';
import { Icon } from '../../shared/ui/icon';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Modal } from '../../shared/ui/modal';
import { FieldError } from '../../shared/ui/field-error';
import { Pagination } from '../../shared/ui/pagination';
import { DataState } from '../../shared/ui/data-state';
@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    FieldAccessibility,
    FormsModule,
    ReactiveFormsModule,
    KztPipe,
    Icon,
    Modal,
    ConfirmDialog,
    FieldError,
    Pagination,
    DataState,
  ],
  templateUrl: './products.page.html',
})
export class ProductsPage {
  readonly data = inject(ERP_DATA);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly query = signal('');
  readonly category = signal('');
  readonly page = signal(1);
  readonly sort = signal<'product_name' | 'unit_price' | 'stock_quantity'>('product_name');
  readonly direction = signal(1);
  readonly deleting = signal<Product | null>(null);
  readonly editing = signal<Product | null>(null);
  readonly formOpen = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly categories = computed(() =>
    [
      ...new Set(
        this.data
          .products()
          .map((p) => p.category)
          .filter(Boolean),
      ),
    ].sort(),
  );
  readonly form = this.fb.group({
    product_name: ['', [Validators.required, Validators.maxLength(100)]],
    category: ['', Validators.maxLength(50)],
    unit_price: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(99999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
  });
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sort();
    return this.data
      .products()
      .filter(
        (p) =>
          (!this.category() || p.category === this.category()) &&
          `${p.product_name} ${p.category}`.toLowerCase().includes(q),
      )
      .slice()
      .sort(
        (a, b) =>
          (key === 'product_name'
            ? a.product_name.localeCompare(b.product_name)
            : a[key] - b[key]) * this.direction(),
      );
  });
  readonly currentPage = computed(() =>
    Math.min(this.page(), Math.max(1, Math.ceil(this.filtered().length / 5))),
  );
  readonly rows = computed(() =>
    this.filtered().slice((this.currentPage() - 1) * 5, this.currentPage() * 5),
  );
  search(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  filter(value: string): void {
    this.category.set(value);
    this.page.set(1);
  }
  sortBy(key: 'product_name' | 'unit_price' | 'stock_quantity'): void {
    this.direction.set(this.sort() === key ? -this.direction() : 1);
    this.sort.set(key);
    this.page.set(1);
  }
  open(product?: Product): void {
    if (this.data.permissions?.()?.manageCatalog === false || this.data.canWrite?.() === false) {
      this.error.set('Connect with write access in Settings first.');
      return;
    }
    this.editing.set(product ?? null);
    this.form.reset(product ?? { product_name: '', category: '', unit_price: 0 });
    this.error.set('');
    this.formOpen.set(true);
  }
  askDelete(product: Product): void {
    this.error.set('');
    this.deleting.set(product);
  }
  async remove(): Promise<void> {
    const product = this.deleting();
    if (!product || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      if (!this.data.deleteProduct) throw new Error('Product deletion is unavailable.');
      await this.data.deleteProduct(product.product_id);
      this.deleting.set(null);
      this.page.set(1);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.data.saveProduct(this.form.getRawValue(), this.editing()?.product_id);
      this.formOpen.set(false);
      this.page.set(1);
      this.category.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
