import { computed, inject, Injectable, signal } from "@angular/core";
import { environment } from "../../../environments/environment";
import { ApiDataService } from "./api-data.service";
import { ErpData, OrderDraft, OrderStatus, Product, Supplier } from "./models";
import { Notifications } from "./notifications.service";
@Injectable({ providedIn: "root" })
export class WorkspaceDataService implements ErpData {
  readonly api = inject(ApiDataService);
  private readonly notices = inject(Notifications);
  private readonly active = signal<ErpData>(this.api);
  readonly switching = signal(false);
  readonly demoAvailable = environment.enableDemoMode;
  get mode(): "api" | "demo" {
    return this.active().mode;
  }
  readonly suppliers = computed(() => this.active().suppliers());
  readonly products = computed(() => this.active().products());
  readonly orders = computed(() => this.active().orders());
  readonly items = computed(() => this.active().items());
  readonly loading = computed(
    () => this.switching() || this.active().loading(),
  );
  readonly error = computed(() => this.active().error());
  readonly busy = computed(() => this.active().busy?.() ?? false);
  readonly permissions = computed(() =>
    this.mode === "demo"
      ? {
          manageCatalog: true,
          createOrders: true,
          transitionOrders: true,
          deleteRecords: true,
        }
      : this.api.permissions(),
  );
  readonly canWrite = computed(
    () => this.mode === "demo" || (this.active().canWrite?.() ?? false),
  );
  readonly lowStockThreshold = computed(() =>
    this.active().lowStockThreshold(),
  );
  readonly dashboard = computed(() => this.active().dashboard?.() ?? null);
  readonly supplierSpending = computed(
    () => this.active().supplierSpending?.() ?? [],
  );
  readonly orderStatuses = computed(
    () => this.active().orderStatuses?.() ?? [],
  );
  async useDemo(): Promise<void> {
    if (!this.demoAvailable || this.busy() || this.loading())
      throw new Error("Cannot switch modes during an active request.");
    this.switching.set(true);
    try {
      const { DemoDataService } = await import("./demo-data.service");
      this.api.disconnect();
      this.active.set(new DemoDataService());
      this.notices.clear();
    } finally {
      this.switching.set(false);
    }
  }
  useApi(): void {
    if (this.busy() || this.loading())
      throw new Error("Wait for requests to finish.");
    this.api.disconnect();
    this.active.set(this.api);
    this.notices.clear();
  }
  connect(token: string): Promise<void> {
    if (this.mode !== "api") throw new Error("Select API mode first.");
    return this.api.connect(token);
  }
  disconnect(): void {
    this.api.disconnect();
    this.notices.clear();
  }
  async refresh(): Promise<void> {
    if (this.mode === "api") await this.api.refresh();
  }
  async loadOrder(id: number): Promise<void> {
    await this.active().loadOrder?.(id);
  }
  private async demoWrite(
    operation: () => void | Promise<void>,
    label: string,
  ): Promise<void> {
    await operation();
    if (this.mode === "demo")
      this.notices.show(
        "success",
        `${label} in this demo session only. PostgreSQL was not changed.`,
      );
  }
  saveSupplier(
    value: Omit<Supplier, "supplier_id">,
    id?: number,
  ): Promise<void> {
    return this.demoWrite(
      () => this.active().saveSupplier(value, id),
      "Supplier saved",
    );
  }
  deleteSupplier(id: number): Promise<void> {
    return this.demoWrite(
      () => this.active().deleteSupplier(id),
      "Supplier deleted",
    );
  }
  saveProduct(
    value: Omit<Product, "product_id" | "stock_quantity">,
    id?: number,
  ): Promise<void> {
    return this.demoWrite(
      () => this.active().saveProduct(value, id),
      "Product saved",
    );
  }
  async deleteProduct(id: number): Promise<void> {
    const current = this.active();
    if (!current.deleteProduct)
      throw new Error("Product deletion is not available in this mode.");
    await this.demoWrite(() => current.deleteProduct!(id), "Product deleted");
  }
  async createOrder(value: OrderDraft): Promise<number> {
    const id = await this.active().createOrder(value);
    if (this.mode === "demo")
      this.notices.show(
        "success",
        "Order created in memory only. PostgreSQL was not changed.",
      );
    return id;
  }
  transitionOrder(id: number, status: OrderStatus): Promise<void> {
    return this.demoWrite(
      () => this.active().transitionOrder(id, status),
      `Order marked ${status}`,
    );
  }
  async setLowStockThreshold(value: number): Promise<void> {
    await this.active().setLowStockThreshold(value);
  }
  reset(): void {
    if (this.mode !== "demo") throw new Error("Only demo data can be reset.");
    this.active().reset();
    this.notices.show(
      "success",
      "Demo session reset. PostgreSQL was not changed.",
    );
  }
}
