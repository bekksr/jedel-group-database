import { computed, inject, Injectable, signal } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  ApiAccess,
  ApiDashboard,
  ApiOrder,
  ApiProduct,
  ApiSpending,
  ApiSupplier,
  Page,
  StatusCount,
} from "./api-contracts";
import {
  Capabilities,
  DashboardData,
  ErpData,
  OrderDraft,
  OrderItem,
  OrderStatus,
  Product,
  PurchaseOrder,
  Spending,
  Supplier,
  allowedTransitions,
} from "./models";
import { Notifications } from "./notifications.service";
import { apiError } from "./api-errors";

interface Snapshot {
  suppliers: Supplier[];
  products: Product[];
  orders: PurchaseOrder[];
  items: OrderItem[];
  dashboard: DashboardData | null;
  spending: Spending[];
  statuses: StatusCount[];
}
const empty = (): Snapshot => ({
  suppliers: [],
  products: [],
  orders: [],
  items: [],
  dashboard: null,
  spending: [],
  statuses: [],
});
export function decimalValue(value: string): number {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("The API returned an invalid monetary value.");
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  const result = Number(value);
  const reconstructed = Number.isFinite(result)
    ? new Intl.NumberFormat("en-US", {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
        .format(result)
        .replace(".", "")
    : "";
  if (
    cents > BigInt(Number.MAX_SAFE_INTEGER) ||
    !reconstructed ||
    BigInt(reconstructed) !== cents
  )
    throw new Error(
      "The API amount exceeds safe display precision. Contact support; do not resubmit the operation.",
    );
  return result;
}
const supplier = (s: ApiSupplier): Supplier => ({
  ...s,
  phone: s.phone ?? "",
  address: s.address ?? "",
});
const product = (p: ApiProduct): Product => ({
  ...p,
  category: p.category ?? "",
  unit_price: decimalValue(p.unit_price),
});
const order = (o: ApiOrder): PurchaseOrder => ({
  order_id: o.order_id,
  supplier_id: o.supplier_id,
  order_date: o.order_date,
  expected_delivery_date: o.expected_delivery_date,
  status: o.status,
  total: decimalValue(o.total),
});
const items = (o: ApiOrder): OrderItem[] =>
  o.items.map((i) => ({
    item_id: i.item_id,
    order_id: o.order_id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: decimalValue(i.unit_price),
    line_total: decimalValue(i.line_total),
  }));
const spending = (rows: ApiSpending[]): Spending[] =>
  rows.map((s) => ({
    label: s.supplier_name,
    value: decimalValue(s.total),
    orders: s.order_count,
  }));

@Injectable({ providedIn: "root" })
export class ApiDataService implements ErpData {
  readonly mode = "api" as const;
  private readonly http = inject(HttpClient);
  private readonly notices = inject(Notifications);
  private readonly state = signal<Snapshot>(empty());
  private token = "";
  private epoch = 0;
  private readonly threshold = signal(20);
  readonly connected = signal(false);
  readonly canWrite = signal(false);
  readonly role = signal("not connected");
  readonly permissions = signal<Capabilities>({
    manageCatalog: false,
    createOrders: false,
    transitionOrders: false,
    deleteRecords: false,
  });
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal(
    "API not connected. Open Settings to enter an access token and connect to PostgreSQL through Django.",
  );
  readonly suppliers = computed(() => this.state().suppliers);
  readonly products = computed(() => this.state().products);
  readonly orders = computed(() => this.state().orders);
  readonly items = computed(() => this.state().items);
  readonly dashboard = computed(() => this.state().dashboard);
  readonly supplierSpending = computed(() => this.state().spending);
  readonly orderStatuses = computed(() => this.state().statuses);
  readonly lowStockThreshold = this.threshold.asReadonly();
  readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, "");

  private url(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }
  private get<T>(path: string): Promise<T> {
    return firstValueFrom(
      this.http
        .get<T>(this.url(path), { headers: this.headers() })
        .pipe(timeout(15000)),
    );
  }
  private async all<T>(resource: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; page <= 10000; page++) {
      // Never follow an absolute pagination URL with a bearer token.
      const response = await this.get<Page<T>>(`${resource}/?page=${page}`);
      result.push(...response.results);
      if (!response.next) return result;
    }
    throw new Error("The result set is too large to load. Contact support.");
  }
  async connect(token: string): Promise<void> {
    if (this.busy() || this.loading())
      throw new Error("Wait for the current request to finish.");
    this.disconnect();
    this.token = token.trim();
    if (!this.token || /\s/.test(this.token))
      throw new Error("Enter a valid bearer access token.");
    await this.refresh();
  }
  disconnect(): void {
    this.epoch++;
    this.token = "";
    this.connected.set(false);
    this.canWrite.set(false);
    this.role.set("not connected");
    this.permissions.set({
      manageCatalog: false,
      createOrders: false,
      transitionOrders: false,
      deleteRecords: false,
    });
    this.state.set(empty());
    this.loading.set(false);
    this.error.set("API not connected. Connect in Settings.");
  }
  async refresh(): Promise<void> {
    if (this.loading())
      throw new Error(
        "The workspace is already refreshing. Wait for it to finish.",
      );
    if (!this.token) {
      this.error.set("API not connected. Connect in Settings.");
      throw new Error(this.error());
    }
    const epoch = ++this.epoch;
    this.loading.set(true);
    try {
      const [
        access,
        suppliers,
        products,
        orders,
        dashboard,
        supplierReport,
        statusReport,
      ] = await Promise.all([
        this.get<ApiAccess>("access/"),
        this.all<ApiSupplier>("suppliers"),
        this.all<ApiProduct>("products"),
        this.all<ApiOrder>("orders"),
        this.get<ApiDashboard>(
          `dashboard/?low_stock_threshold=${this.threshold()}`,
        ),
        this.get<{ results: ApiSpending[] }>("analytics/supplier-spending/"),
        this.get<{ results: StatusCount[] }>("analytics/order-status/"),
      ]);
      if (epoch !== this.epoch) return;
      const summary: DashboardData = {
        supplierCount: dashboard.total_suppliers,
        productCount: dashboard.total_products,
        orderCount: dashboard.total_purchase_orders,
        purchasingValue: decimalValue(dashboard.total_purchasing_value),
        deliveredValue: decimalValue(dashboard.delivered_order_value),
        stockUnits: dashboard.stock_overview.total_units,
        lowStock: dashboard.stock_overview.low_stock_products.map(product),
        recentOrders: dashboard.recent_orders.map(order),
        spending: spending(dashboard.supplier_spending),
        statuses: dashboard.status_distribution,
      };
      this.state.set({
        suppliers: suppliers.map(supplier),
        products: products.map(product),
        orders: orders.map(order),
        items: orders.flatMap(items),
        dashboard: summary,
        spending: spending(supplierReport.results),
        statuses: statusReport.results,
      });
      this.canWrite.set(access.can_write === true);
      this.role.set(access.role ?? (access.can_write ? "admin" : "viewer"));
      const caps = access.capabilities;
      this.permissions.set({
        manageCatalog: caps
          ? caps.manage_catalog === true
          : access.can_write === true,
        createOrders: caps
          ? caps.create_orders === true
          : access.can_write === true,
        transitionOrders: caps
          ? caps.transition_orders === true
          : access.can_write === true,
        deleteRecords: caps
          ? caps.delete_records === true
          : access.can_write === true,
      });
      this.connected.set(true);
      this.error.set("");
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.state.set(empty());
      this.connected.set(false);
      this.canWrite.set(false);
      this.role.set("not connected");
      this.permissions.set({
        manageCatalog: false,
        createOrders: false,
        transitionOrders: false,
        deleteRecords: false,
      });
      this.error.set(apiError(e));
      throw new Error(this.error());
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }
  private async write<T>(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body: unknown,
    label: string,
  ): Promise<T> {
    if (this.busy() || this.loading())
      throw new Error("Wait for the current request to finish.");
    if (!this.connected() || !this.canWrite())
      throw new Error(
        "Connect with a write-scoped token in Settings before changing records.",
      );
    this.busy.set(true);
    try {
      let response: T;
      try {
        response = await firstValueFrom(
          this.http
            .request<T>(method, this.url(path), {
              body,
              headers: this.headers(),
            })
            .pipe(timeout(30000)),
        );
      } catch (e) {
        const message = apiError(e);
        // A lost response may follow a committed transaction. Hide stale state and
        // block further writes until the server has been successfully refreshed.
        if (
          !(e instanceof HttpErrorResponse) ||
          e.status === 0 ||
          (e.status >= 200 && e.status < 300) ||
          e.status >= 500 ||
          e.status === 401
        ) {
          this.state.set(empty());
          this.connected.set(false);
          this.canWrite.set(false);
          this.role.set("not connected");
          this.permissions.set({
            manageCatalog: false,
            createOrders: false,
            transitionOrders: false,
            deleteRecords: false,
          });
          this.error.set(message);
        } else if (e.status === 409 || e.status === 404 || e.status === 403) {
          try {
            await this.refresh();
          } catch {
            /* Preserve the original actionable conflict. */
          }
        }
        this.notices.show("error", message);
        throw new Error(message);
      }
      try {
        await this.refresh();
        this.notices.show("success", `${label} confirmed by the server.`);
      } catch {
        this.notices.show(
          "warning",
          `${label} was confirmed, but refreshing failed. Do not submit it again. Reconnect or refresh to retrieve current records.`,
        );
      }
      return response;
    } finally {
      this.busy.set(false);
    }
  }
  async saveSupplier(
    value: Omit<Supplier, "supplier_id">,
    id?: number,
  ): Promise<void> {
    await this.write(
      id === undefined ? "POST" : "PATCH",
      id === undefined ? "suppliers/" : `suppliers/${id}/`,
      value,
      id === undefined ? "Supplier creation" : "Supplier update",
    );
  }
  async deleteSupplier(id: number): Promise<void> {
    await this.write("DELETE", `suppliers/${id}/`, null, "Supplier deletion");
  }
  async saveProduct(
    value: Omit<Product, "product_id" | "stock_quantity">,
    id?: number,
  ): Promise<void> {
    await this.write(
      id === undefined ? "POST" : "PATCH",
      id === undefined ? "products/" : `products/${id}/`,
      {
        product_name: value.product_name,
        category: value.category,
        unit_price: value.unit_price.toFixed(2),
      },
      id === undefined ? "Product creation" : "Product update",
    );
  }
  async deleteProduct(id: number): Promise<void> {
    await this.write("DELETE", `products/${id}/`, null, "Product deletion");
  }
  async createOrder(value: OrderDraft): Promise<number> {
    const response = await this.write<ApiOrder>(
      "POST",
      "orders/",
      value,
      "Purchase order creation",
    );
    return response.order_id;
  }
  async transitionOrder(id: number, status: OrderStatus): Promise<void> {
    const current = this.orders().find((o) => o.order_id === id);
    if (!current || !allowedTransitions(current.status).includes(status))
      throw new Error(
        "This status transition is not allowed. Refresh the order to check its current state.",
      );
    const actions: Partial<Record<OrderStatus, string>> = {
      Approved: "approve",
      Delivered: "deliver",
      Cancelled: "cancel",
    };
    await this.write(
      "POST",
      `orders/${id}/${actions[status]}/`,
      {},
      `Order ${status.toLowerCase()} operation`,
    );
  }
  async loadOrder(id: number): Promise<void> {
    if (this.loading() || this.busy())
      throw new Error("Wait for the workspace request to finish.");
    const epoch = this.epoch;
    try {
      const response = await this.get<ApiOrder>(`orders/${id}/`);
      if (epoch !== this.epoch) return;
      const mapped = order(response);
      const mappedItems = items(response);
      this.state.update((s) => ({
        ...s,
        orders: [...s.orders.filter((o) => o.order_id !== id), mapped],
        items: [...s.items.filter((i) => i.order_id !== id), ...mappedItems],
      }));
    } catch (e) {
      throw new Error(apiError(e));
    }
  }
  async setLowStockThreshold(value: number): Promise<void> {
    if (this.loading() || this.busy())
      throw new Error("Wait for the current request to finish.");
    if (!Number.isInteger(value) || value < 0 || value > 2147483647)
      throw new Error("Enter a nonnegative whole-number threshold.");
    const previous = this.threshold();
    this.threshold.set(value);
    try {
      await this.refresh();
    } catch (e) {
      this.threshold.set(previous);
      throw e;
    }
  }
  reset(): void {
    throw new Error("API data cannot be reset from the browser.");
  }
}
