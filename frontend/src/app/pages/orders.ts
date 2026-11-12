import { WorkspaceStatus } from './workspace-status';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../store";
import {
  allowedTransitions,
  localDate,
  ORDER_STATUSES,
  OrderStatus,
  orderTotal,
} from "../models";
@Component({selector: "ng-component-orders",
  imports: [WorkspaceStatus, DecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: "./orders.html",
})
export class OrdersPage {
  readonly data = inject(Store);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly statuses = ORDER_STATUSES;
  readonly transitions = allowedTransitions;
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<number | null>(null);
  canCreate() {
    return (
      this.data.canWrite() &&
      this.data.permissions().createOrders &&
      !this.data.loading() &&
      !this.data.busy() &&
      !this.saving()
    );
  }
  canTransition() {
    return (
      this.data.canWrite() &&
      this.data.permissions().transitionOrders &&
      !this.data.loading() &&
      !this.data.busy() &&
      !this.saving()
    );
  }
  readonly selectedId = signal<number | null>(null);
  readonly error = signal("");
  readonly message = signal("");
  readonly status = signal("");
  readonly selected = computed(() =>
    this.data.orders().find((o) => o.order_id === this.selectedId()),
  );
  readonly filtered = computed(() =>
    this.data
      .orders()
      .filter((o) => !this.status() || o.status === this.status())
      .slice()
      .sort((a, b) => b.order_id - a.order_id),
  );
  readonly form = this.fb.group({
    supplier_id: [0, Validators.min(1)],
    order_date: [localDate(), Validators.required],
    expected_delivery_date: [""],
    items: this.fb.array([this.itemGroup()]),
  });
  constructor() {
    const route = inject(ActivatedRoute);
    const params = route.snapshot.queryParamMap;
    let opened = false;
    effect(() => {
      if (!opened && route.snapshot.data?.['create'] && this.canCreate()) {
        opened = true; untracked(() => this.open());
      }
    });
    if (params.get("new")) {
      this.open();
      const supplier = Number(params.get("supplier"));
      const product = Number(params.get("product"));
      if (this.data.suppliers().some((s) => s.supplier_id === supplier))
        this.form.controls.supplier_id.setValue(supplier);
      if (this.data.products().some((p) => p.product_id === product))
        this.items.at(0).controls.product_id.setValue(product);
    }
  }
  itemGroup() {
    return this.fb.group({
      product_id: [0, Validators.min(1)],
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
  get items() {
    return this.form.controls.items;
  }
  supplierName(id: number) {
    return (
      this.data.suppliers().find((s) => s.supplier_id === id)?.supplier_name ??
      "Unknown supplier"
    );
  }
  productName(id: number) {
    return (
      this.data.products().find((p) => p.product_id === id)?.product_name ??
      "Unknown product"
    );
  }
  orderItems(id: number) {
    return this.data.items().filter((i) => i.order_id === id);
  }
  total(id: number) {
    return this.data.mode === "api"
      ? (this.data.orders().find((o) => o.order_id === id)?.total ?? 0)
      : orderTotal(id, this.data.items());
  }
  draftTotal() {
    return (
      this.items
        .getRawValue()
        .reduce(
          (sum, i) =>
            sum +
            Math.round(
              (this.data.products().find((p) => p.product_id === i.product_id)
                ?.unit_price ?? 0) * 100,
            ) *
              (Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : 0),
          0,
        ) / 100
    );
  }
  edit(id: number) {
    if (!this.canCreate() || this.data.mode !== 'api') return;
    const order = this.data.orders().find(o => o.order_id === id);
    if (!order || order.status !== 'Pending') return;
    this.open(); this.editingId.set(id);
    this.form.patchValue({supplier_id: order.supplier_id, order_date: order.order_date, expected_delivery_date: order.expected_delivery_date ?? ''});
    this.items.clear();
    for (const item of this.orderItems(id)) {
      const group = this.itemGroup(); group.patchValue({product_id: item.product_id, quantity: item.quantity}); this.items.push(group);
    }
  }
  open() {
    this.editingId.set(null);
    if (!this.canCreate()) {
      this.error.set("Your assigned role cannot create orders.");
      return;
    }
    this.form.reset({
      supplier_id: 0,
      order_date: localDate(),
      expected_delivery_date: "",
    });
    this.items.clear();
    this.items.push(this.itemGroup());
    this.error.set("");
    this.message.set("");
    this.formOpen.set(true);
  }
  async save() {
    if (!this.canCreate()) return;
    this.error.set("");
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        "Choose a supplier and products, enter an order date and positive whole-number quantities.",
      );
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const draft = {...v, expected_delivery_date: v.expected_delivery_date || null};
      const id = this.editingId() === null ? await this.data.createOrder(draft) : await this.data.updateOrder(this.editingId()!, draft);
      this.selectedId.set(id);
      this.status.set("");
      this.formOpen.set(false);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async transition(id: number, status: OrderStatus) {
    if (!this.canTransition()) return;
    this.saving.set(true);
    this.error.set("");
    try {
      await this.data.transitionOrder(id, status);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
