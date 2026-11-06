import { Injectable, signal } from "@angular/core";
import {
  ErpData,
  Supplier,
  Product,
  PurchaseOrder,
  OrderItem,
  OrderDraft,
  OrderStatus,
  allowedTransitions,
} from "./models";
import {
  SEED_SUPPLIERS,
  SEED_PRODUCTS,
  SEED_PURCHASE_ORDERS,
  SEED_PURCHASE_ORDER_ITEMS,
} from "./demo-seed";

@Injectable()
export class DemoDataService implements ErpData {
  readonly mode = "demo" as const;
  private readonly supplierState = signal<readonly Supplier[]>(
    structuredClone(SEED_SUPPLIERS),
  );
  private readonly productState = signal<readonly Product[]>(
    structuredClone(SEED_PRODUCTS),
  );
  private readonly orderState = signal<readonly PurchaseOrder[]>(
    structuredClone(SEED_PURCHASE_ORDERS),
  );
  private readonly itemState = signal<readonly OrderItem[]>(
    structuredClone(SEED_PURCHASE_ORDER_ITEMS),
  );
  private readonly thresholdState = signal(20);
  readonly suppliers = this.supplierState.asReadonly();
  readonly products = this.productState.asReadonly();
  readonly orders = this.orderState.asReadonly();
  readonly items = this.itemState.asReadonly();
  readonly lowStockThreshold = this.thresholdState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly error = signal("").asReadonly();
  private nextSupplierId = 4;
  private nextProductId = 6;
  private nextOrderId = 4;
  private nextItemId = 7;

  saveSupplier(value: Omit<Supplier, "supplier_id">, id?: number): void {
    const clean = {
      supplier_name: value.supplier_name.trim(),
      email: value.email.trim().toLowerCase(),
      phone: value.phone.trim(),
      address: value.address.trim(),
    };
    if (!clean.supplier_name || clean.supplier_name.length > 100)
      throw new Error("Enter a supplier name of up to 100 characters.");
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) ||
      clean.email.length > 100
    )
      throw new Error("Enter a valid email address of up to 100 characters.");
    if (clean.phone.length > 20 || clean.address.length > 255)
      throw new Error("Phone or address exceeds its maximum length.");
    if (
      this.suppliers().some(
        (s) => s.supplier_id !== id && s.email.toLowerCase() === clean.email,
      )
    )
      throw new Error("A supplier with this email already exists.");
    if (id !== undefined && !this.suppliers().some((s) => s.supplier_id === id))
      throw new Error("Supplier no longer exists.");
    const saved = { ...clean, supplier_id: id ?? this.nextSupplierId++ };
    this.supplierState.update((rows) =>
      id === undefined
        ? [...rows, saved]
        : rows.map((s) => (s.supplier_id === id ? saved : s)),
    );
  }
  deleteSupplier(id: number): void {
    if (this.orders().some((o) => o.supplier_id === id))
      throw new Error(
        "This supplier has purchase orders and cannot be deleted.",
      );
    if (!this.suppliers().some((s) => s.supplier_id === id))
      throw new Error("Supplier no longer exists.");
    this.supplierState.update((rows) =>
      rows.filter((s) => s.supplier_id !== id),
    );
  }
  saveProduct(
    value: Omit<Product, "product_id" | "stock_quantity">,
    id?: number,
  ): void {
    const name = value.product_name.trim();
    const category = value.category.trim();
    if (!name || name.length > 100 || category.length > 50)
      throw new Error("Check product name and category lengths.");
    if (
      !Number.isFinite(value.unit_price) ||
      value.unit_price < 0 ||
      value.unit_price > 99999999.99 ||
      Math.abs(value.unit_price * 100 - Math.round(value.unit_price * 100)) >
        0.0001
    )
      throw new Error(
        "Enter a nonnegative price with up to two decimal places.",
      );
    const existing = this.products().find((p) => p.product_id === id);
    if (id !== undefined && !existing)
      throw new Error("Product no longer exists.");
    const saved: Product = {
      product_id: id ?? this.nextProductId++,
      product_name: name,
      category,
      unit_price: value.unit_price,
      stock_quantity: existing?.stock_quantity ?? 0,
    };
    this.productState.update((rows) =>
      id === undefined
        ? [...rows, saved]
        : rows.map((p) => (p.product_id === id ? saved : p)),
    );
  }
  createOrder(value: OrderDraft): number {
    if (!this.suppliers().some((s) => s.supplier_id === value.supplier_id))
      throw new Error("Select an existing supplier.");
    const validDate = (v: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v;
    if (
      !validDate(value.order_date) ||
      (value.expected_delivery_date &&
        (!validDate(value.expected_delivery_date) ||
          value.expected_delivery_date < value.order_date))
    )
      throw new Error("Expected delivery must be on or after the order date.");
    if (!value.items.length) throw new Error("Add at least one product.");
    if (
      new Set(value.items.map((i) => i.product_id)).size !== value.items.length
    )
      throw new Error("Each product can appear only once in an order.");
    const newItems = value.items.map((i) => {
      const product = this.products().find(
        (p) => p.product_id === i.product_id,
      );
      if (
        !product ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 2147483647
      )
        throw new Error(
          "Select products and enter positive whole-number quantities.",
        );
      return {
        product_id: product.product_id,
        quantity: i.quantity,
        unit_price: product.unit_price,
      };
    });
    const cents = newItems.map(
      (i) => Math.round(i.unit_price * 100) * i.quantity,
    );
    if (
      cents.some((value) => !Number.isSafeInteger(value)) ||
      !Number.isSafeInteger(cents.reduce((sum, value) => sum + value, 0))
    )
      throw new Error(
        "Order value exceeds the supported precision limit. Reduce the quantities.",
      );
    const id = this.nextOrderId++;
    this.itemState.update((rows) => [
      ...rows,
      ...newItems.map((i) => ({
        ...i,
        item_id: this.nextItemId++,
        order_id: id,
      })),
    ]);
    this.orderState.update((rows) => [
      ...rows,
      {
        order_id: id,
        supplier_id: value.supplier_id,
        order_date: value.order_date,
        expected_delivery_date: value.expected_delivery_date || null,
        status: "Pending",
      },
    ]);
    return id;
  }
  transitionOrder(id: number, status: OrderStatus): void {
    const order = this.orders().find((o) => o.order_id === id);
    if (!order || !allowedTransitions(order.status).includes(status))
      throw new Error("This order status transition is not allowed.");
    if (status === "Delivered") {
      const lines = this.items().filter((i) => i.order_id === id);
      if (!lines.length) throw new Error("An empty order cannot be delivered.");
      const updated = this.products().map((p) => ({
        ...p,
        stock_quantity:
          p.stock_quantity +
          (lines.find((i) => i.product_id === p.product_id)?.quantity ?? 0),
      }));
      if (updated.some((p) => p.stock_quantity > 2147483647))
        throw new Error("Delivery would exceed the stock quantity limit.");
      this.productState.set(updated);
    }
    this.orderState.update((rows) =>
      rows.map((o) => (o.order_id === id ? { ...o, status } : o)),
    );
  }
  setLowStockThreshold(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 2147483647)
      throw new Error("Enter a nonnegative whole-number threshold.");
    this.thresholdState.set(value);
  }
  deleteProduct(id: number): void {
    const product = this.products().find((p) => p.product_id === id);
    if (!product) throw new Error("Product no longer exists.");
    if (product.stock_quantity || this.items().some((i) => i.product_id === id))
      throw new Error(
        "Products with inventory or order references cannot be deleted.",
      );
    this.productState.update((rows) => rows.filter((p) => p.product_id !== id));
  }
  reset(): void {
    this.supplierState.set(structuredClone(SEED_SUPPLIERS));
    this.productState.set(structuredClone(SEED_PRODUCTS));
    this.orderState.set(structuredClone(SEED_PURCHASE_ORDERS));
    this.itemState.set(structuredClone(SEED_PURCHASE_ORDER_ITEMS));
    this.thresholdState.set(20);
    this.nextSupplierId = 4;
    this.nextProductId = 6;
    this.nextOrderId = 4;
    this.nextItemId = 7;
  }
}
