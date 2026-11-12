import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { DecimalPipe } from "@angular/common";
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, ParamMap, RouterLink } from "@angular/router";
import { Store } from "../store";
import {
  allowedTransitions,
  localDate,
  ORDER_STATUSES,
  OrderStatus,
  orderTotal,
} from "../models";
@Component({
  imports: [DecimalPipe, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./orders.html",
})
export class OrdersPage {
  readonly data = inject(Store);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderDetails = viewChild<ElementRef<HTMLElement>>("orderDetails");
  readonly statuses = ORDER_STATUSES;
  readonly transitions = allowedTransitions;
  readonly formOpen = signal(false);
  readonly saving = signal(false);
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
    const queryParams = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
    let applied: ParamMap | undefined;
    effect(() => {
      const params = queryParams();
      if (params === applied || !params.get("new") || !this.canCreate()) return;
      applied = params;
      untracked(() => this.open(Number(params.get("supplier")), Number(params.get("product"))));
    });
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
  open(supplierId = 0, productId = 0): void {
    if (!this.canCreate()) return;
    const supplier = this.data.suppliers().some((row) => row.supplier_id === supplierId) ? supplierId : 0;
    const product = this.data.products().some((row) => row.product_id === productId) ? productId : 0;
    this.form.reset({
      supplier_id: supplier,
      order_date: localDate(),
      expected_delivery_date: "",
    });
    this.items.clear();
    const firstItem = this.itemGroup();
    firstItem.controls.product_id.setValue(product);
    this.items.push(firstItem);
    this.error.set("");
    this.formOpen.set(true);
  }

  viewOrder(id: number): void {
    this.selectedId.set(id);
    if (this.destroyRef.destroyed) return;
    afterNextRender(() => this.orderDetails()?.nativeElement.focus(), { injector: this.injector });
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
    const v = this.form.getRawValue();
    if (v.expected_delivery_date && v.expected_delivery_date < v.order_date) {
      this.error.set("Expected delivery must be on or after the order date.");
      return;
    }
    this.saving.set(true);
    try {
      const id = await this.data.createOrder({
        ...v,
        expected_delivery_date: v.expected_delivery_date || null,
      });
      this.status.set("");
      this.formOpen.set(false);
      this.viewOrder(id);
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
