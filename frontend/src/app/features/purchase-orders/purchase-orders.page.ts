import { FieldAccessibility } from '../../shared/ui/field-accessibility';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ERP_DATA,
  ORDER_STATUSES,
  OrderStatus,
  PurchaseOrder,
  allowedTransitions,
  localDate,
  orderTotal,
} from '../../core/data/models';
import { KztPipe } from '../../shared/pipes/kzt.pipe';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { FieldError } from '../../shared/ui/field-error';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Pagination } from '../../shared/ui/pagination';
import { DataState } from '../../shared/ui/data-state';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-purchase-orders-page',
  standalone: true,
  imports: [
    FieldAccessibility,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    KztPipe,
    Icon,
    Modal,
    FieldError,
    ConfirmDialog,
    Pagination,
    DataState,
    StatusBadge,
  ],
  templateUrl: './purchase-orders.page.html',
})
export class PurchaseOrdersPage {
  readonly data = inject(ERP_DATA);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly statuses = ORDER_STATUSES;
  readonly transitions = allowedTransitions;
  readonly query = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly sort = signal<'order_id' | 'order_date' | 'total'>('order_id');
  readonly direction = signal(-1);
  readonly formOpen = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly confirmation = signal<{ id: number; status: OrderStatus } | null>(null);
  readonly transitionError = signal('');
  readonly selected = computed(() =>
    this.data.orders().find((o) => o.order_id === this.selectedId()),
  );
  readonly form = this.fb.group({
    supplier_id: [0, [Validators.required, Validators.min(1)]],
    order_date: [localDate(), Validators.required],
    expected_delivery_date: [''],
    items: this.fb.array([this.itemGroup()]),
  });
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sort();
    return this.data
      .orders()
      .filter(
        (o) =>
          (!this.status() || o.status === this.status()) &&
          `${this.orderNumber(o.order_id)} ${this.supplierName(o.supplier_id)}`
            .toLowerCase()
            .includes(q),
      )
      .slice()
      .sort(
        (a, b) =>
          (key === 'total'
            ? this.total(a.order_id) - this.total(b.order_id)
            : key === 'order_id'
              ? a.order_id - b.order_id
              : a.order_date.localeCompare(b.order_date) || a.order_id - b.order_id) *
          this.direction(),
      );
  });
  readonly currentPage = computed(() =>
    Math.min(this.page(), Math.max(1, Math.ceil(this.filtered().length / 5))),
  );
  readonly rows = computed(() =>
    this.filtered().slice((this.currentPage() - 1) * 5, this.currentPage() * 5),
  );
  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    if (params.get('action') === 'new') this.open();
    const id = Number(params.get('order'));
    if (id && this.data.mode === 'demo' && this.data.orders().some((o) => o.order_id === id))
      this.selectedId.set(id);
    else if (id && this.data.mode === 'api' && !this.data.error() && !this.data.loading())
      void this.viewOrder(id);
  }
  itemGroup() {
    return this.fb.group({
      product_id: [0, [Validators.required, Validators.min(1)]],
      quantity: [
        1,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(2147483647),
          Validators.pattern(/^\d+$/),
        ],
      ],
    });
  }
  get itemControls() {
    return this.form.controls.items;
  }
  orderNumber(id: number): string {
    return `PO-${id.toString().padStart(4, '0')}`;
  }
  supplierName(id: number): string {
    return (
      this.data.suppliers().find((s) => s.supplier_id === id)?.supplier_name ?? 'Unknown supplier'
    );
  }
  productName(id: number): string {
    return this.data.products().find((p) => p.product_id === id)?.product_name ?? 'Unknown product';
  }
  total(id: number): number {
    return this.data.mode === 'api'
      ? (this.data.orders().find((o) => o.order_id === id)?.total ?? 0)
      : orderTotal(id, this.data.items());
  }
  orderItems(id: number) {
    return this.data.items().filter((i) => i.order_id === id);
  }
  unitPrice(id: number): number {
    return this.data.products().find((p) => p.product_id === id)?.unit_price ?? 0;
  }
  draftLine(id: number, quantity: number): number {
    return Number.isFinite(quantity) && quantity > 0
      ? (Math.round(this.unitPrice(id) * 100) * quantity) / 100
      : 0;
  }
  draftTotal(): number {
    return (
      this.itemControls
        .getRawValue()
        .reduce((sum, i) => sum + Math.round(this.draftLine(i.product_id, i.quantity) * 100), 0) /
      100
    );
  }
  search(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  filter(value: string): void {
    this.status.set(value);
    this.page.set(1);
  }
  sortBy(key: 'order_id' | 'order_date' | 'total'): void {
    this.direction.set(this.sort() === key ? -this.direction() : 1);
    this.sort.set(key);
    this.page.set(1);
  }
  open(): void {
    if (this.data.permissions?.()?.createOrders === false || this.data.canWrite?.() === false) {
      this.error.set('Connect with write access in Settings first.');
      return;
    }
    this.form.reset({ supplier_id: 0, order_date: localDate(), expected_delivery_date: '' });
    this.itemControls.clear();
    this.itemControls.push(this.itemGroup());
    this.error.set('');
    this.formOpen.set(true);
  }
  addItem(): void {
    this.itemControls.push(this.itemGroup());
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const raw = this.form.getRawValue();
      const id = await this.data.createOrder({
        ...raw,
        expected_delivery_date: raw.expected_delivery_date || null,
      });
      this.formOpen.set(false);
      this.status.set('');
      this.query.set('');
      this.page.set(1);
      this.selectedId.set(id);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  askTransition(order: PurchaseOrder, status: OrderStatus): void {
    this.transitionError.set('');
    this.confirmation.set({ id: order.order_id, status });
  }
  async confirmTransition(): Promise<void> {
    const action = this.confirmation();
    if (!action || this.saving()) return;
    this.saving.set(true);
    this.transitionError.set('');
    try {
      await this.data.transitionOrder(action.id, action.status);
      this.confirmation.set(null);
    } catch (e) {
      this.transitionError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  readonly detailLoading = signal(false);
  async viewOrder(id: number): Promise<void> {
    if (this.detailLoading()) return;
    this.detailLoading.set(true);
    this.error.set('');
    try {
      await this.data.loadOrder?.(id);
      this.selectedId.set(id);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.detailLoading.set(false);
    }
  }
  transitionMessage(status: OrderStatus): string {
    return status === 'Delivered'
      ? this.data.mode === 'demo'
        ? 'Confirm full delivery in this demo session? Demo stock will increase once.'
        : 'Confirm full delivery in PostgreSQL? Only an approved order can be delivered. The server will update inventory atomically.'
      : status === 'Cancelled'
        ? 'Cancel this order? It will be excluded from purchasing value. This status is final.'
        : 'Approve this purchase order? Approval allows the order to be delivered or cancelled.';
  }
}
