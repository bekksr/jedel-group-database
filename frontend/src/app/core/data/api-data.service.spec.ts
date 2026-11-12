import { OrdersPage } from '../../pages/orders';
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "../../routes";
import { TestBed } from "@angular/core/testing";
import { throwError } from "rxjs";
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApiDataService, decimalValue } from "./api-data.service";
import { WorkspaceDataService } from "./workspace-data.service";
import { ERP_DATA } from "./models";
import { Notifications } from "./notifications.service";
import { useMetrics } from "./metrics";
import {
  ApiDashboard,
  ApiOrder,
  ApiProduct,
  ApiSupplier,
} from "./api-contracts";

const supplier: ApiSupplier = {
  supplier_id: 11,
  supplier_name: "Test supplier",
  email: "test@example.test",
  phone: null,
  address: null,
};
const product: ApiProduct = {
  product_id: 21,
  product_name: "Test product",
  category: null,
  unit_price: "12.50",
  stock_quantity: 0,
};
const order: ApiOrder = {
  order_id: 71,
  supplier_id: 11,
  supplier_name: supplier.supplier_name,
  order_date: "2026-11-06",
  expected_delivery_date: null,
  status: "Approved",
  items: [
    {
      item_id: 81,
      product_id: 21,
      product_name: product.product_name,
      quantity: 2,
      unit_price: "12.50",
      line_total: "25.00",
    },
  ],
  total: "25.00",
};
const page = <T>(results: T[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
});

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
});
describe("Angular to Django API contract and state safety", () => {
  let http: HttpTestingController;
  let api: ApiDataService;
  let workspace: WorkspaceDataService;
  let notices: Notifications;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ERP_DATA, useExisting: WorkspaceDataService },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiDataService);
    workspace = TestBed.inject(WorkspaceDataService);
    notices = TestBed.inject(Notifications);
  });
  afterEach(() => http.verify());
  function flushSnapshot(
    options: {
      stock?: number;
      status?: ApiOrder["status"];
      canWrite?: boolean;
      fail?: string;
      next?: string;
      value?: string;
      role?: "viewer" | "buyer" | "approver" | "admin";
      capabilities?: {
        manage_catalog: boolean;
        create_orders: boolean;
        transition_orders: boolean;
        delete_records: boolean;
      };
    } = {},
  ): void {
    const current = { ...order, status: options.status ?? order.status };
    const currentProduct = { ...product, stock_quantity: options.stock ?? 0 };
    const statuses = [{ status: current.status, count: 1 }];
    const spending = [
      {
        supplier_id: 11,
        supplier_name: supplier.supplier_name,
        total: options.value ?? "25.00",
        order_count: 1,
      },
    ];
    const dashboard: ApiDashboard = {
      currency: "KZT",
      total_suppliers: 1,
      total_products: 1,
      total_purchase_orders: 1,
      total_purchasing_value: options.value ?? "25.00",
      delivered_order_value: current.status === "Delivered" ? "25.00" : "0.00",
      status_distribution: statuses,
      supplier_spending: spending,
      recent_orders: [current],
      stock_overview: {
        total_units: currentProduct.stock_quantity,
        low_stock_threshold: 20,
        low_stock_products: [currentProduct],
      },
    };
    const responses: Record<string, object> = {
      "/api/access/": {
        can_write: options.canWrite ?? true,
        authentication: "shared_bearer_token",
        role_based_security: true,
        role: options.role ?? ((options.canWrite ?? true) ? "admin" : "viewer"),
        ...(options.capabilities ? { capabilities: options.capabilities } : {}),
      },
      "/api/suppliers/?page=1": page([supplier], options.next ?? null),
      "/api/products/?page=1": page([currentProduct]),
      "/api/orders/?page=1": page([current]),
      "/api/dashboard/?low_stock_threshold=20": dashboard,
      "/api/analytics/supplier-spending/": {
        currency: "KZT",
        excludes_cancelled: true,
        results: spending,
      },
      "/api/analytics/order-status/": { results: statuses },
    };
    for (const [url, response] of Object.entries(responses)) {
      const request = http.expectOne(url);
      expect(request.request.headers.get("Authorization")).toBe(
        "Bearer test-access-token",
      );
      if (options.fail === url)
        request.flush(
          { detail: "Unavailable" },
          { status: 503, statusText: "Service Unavailable" },
        );
      else request.flush(response);
    }
  }
  async function connect(
    options: Parameters<typeof flushSnapshot>[0] = {},
  ): Promise<void> {
    const pending = workspace.connect("test-access-token");
    flushSnapshot(options);
    await pending;
  }
  it("defaults to empty API mode without any seeded records or automatic requests", () => {
    expect(workspace.mode).toBe("api");
    expect(workspace.suppliers()).toEqual([]);
    expect(workspace.products()).toEqual([]);
    expect(workspace.canWrite()).toBe(false);
    expect(workspace.error()).toContain("not connected");
  });
  it("normalizes decimal strings, nullable fields, nested items, and server aggregates", async () => {
    await connect({ value: "500.75" });
    expect(workspace.suppliers()[0]?.phone).toBe("");
    expect(workspace.products()[0]?.category).toBe("");
    expect(workspace.products()[0]?.unit_price).toBe(12.5);
    expect(workspace.items()[0]?.order_id).toBe(71);
    expect(workspace.items()[0]?.line_total).toBe(25);
    const dashboard = TestBed.runInInjectionContext(() => useMetrics());
    const analytics = TestBed.runInInjectionContext(() =>
      useMetrics("analytics"),
    );
    expect(dashboard.purchasingValue()).toBe(500.75);
    expect(analytics.spending()[0]?.value).toBe(500.75);
    expect(dashboard.total(71)).toBe(25);
  });
  it("loads subsequent pages using only the configured API origin", async () => {
    const pending = workspace.connect("test-access-token");
    flushSnapshot({ next: "https://untrusted.example/steal" });
    await Promise.resolve();
    const second = http.expectOne("/api/suppliers/?page=2");
    second.flush(
      page([
        { ...supplier, supplier_id: 12, supplier_name: "Second test supplier" },
      ]),
    );
    await pending;
    expect(workspace.suppliers().length).toBe(2);
  });
  it("does not report success or change stock before the server confirms delivery and refresh", async () => {
    await connect();
    const pending = workspace.transitionOrder(71, "Delivered");
    expect(workspace.products()[0]?.stock_quantity).toBe(0);
    expect(notices.messages().length).toBe(0);
    const request = http.expectOne("/api/orders/71/deliver/");
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({});
    request.flush({ ...order, status: "Delivered" });
    await Promise.resolve();
    expect(workspace.products()[0]?.stock_quantity).toBe(0);
    expect(notices.messages().length).toBe(0);
    flushSnapshot({ stock: 2, status: "Delivered" });
    await pending;
    expect(workspace.products()[0]?.stock_quantity).toBe(2);
    expect(notices.messages().at(-1)?.kind).toBe("success");
    await expect(workspace.transitionOrder(71, "Delivered")).rejects.toThrow(
      "not allowed",
    );
  });
  it("maps form validation errors without optimistic changes or success messages", async () => {
    await connect();
    const pending = workspace.saveSupplier(
      {
        supplier_name: "Changed",
        email: "duplicate@example.test",
        phone: "",
        address: "",
      },
      11,
    );
    http
      .expectOne("/api/suppliers/11/")
      .flush(
        { email: ["A supplier with this email already exists."] },
        { status: 400, statusText: "Bad Request" },
      );
    await expect(pending).rejects.toThrow("email");
    expect(workspace.suppliers()[0]?.supplier_name).toBe(
      supplier.supplier_name,
    );
    expect(notices.messages().some((n) => n.kind === "success")).toBe(false);
    expect(workspace.busy()).toBe(false);
  });
  it("sends product prices as decimal strings without inventory fields and refreshes after PATCH", async () => {
    await connect();
    const pending = workspace.saveProduct(
      { product_name: "Updated", category: "", unit_price: 18.25 },
      21,
    );
    const request = http.expectOne("/api/products/21/");
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body).toEqual({
      product_name: "Updated",
      category: "",
      unit_price: "18.25",
    });
    request.flush({ ...product, unit_price: "18.25" });
    await Promise.resolve();
    flushSnapshot();
    await pending;
    expect(notices.messages().at(-1)?.kind).toBe("success");
  });
  it("does not fall back to demo mode when database loading fails", async () => {
    const pending = workspace.connect("test-access-token");
    flushSnapshot({ fail: "/api/dashboard/?low_stock_threshold=20" });
    await expect(pending).rejects.toThrow("unavailable");
    expect(workspace.mode).toBe("api");
    expect(workspace.suppliers()).toEqual([]);
    expect(workspace.canWrite()).toBe(false);
  });
  it("treats a confirmed write followed by refresh failure as confirmed, not as a request to resubmit", async () => {
    await connect();
    const pending = workspace.createOrder({
      supplier_id: 11,
      order_date: "2026-11-06",
      expected_delivery_date: null,
      items: [{ product_id: 21, quantity: 2 }],
    });
    http.expectOne("/api/orders/").flush(order);
    await Promise.resolve();
    flushSnapshot({ fail: "/api/products/?page=1" });
    expect(await pending).toBe(71);
    expect(workspace.orders()).toEqual([]);
    expect(notices.messages().at(-1)?.kind).toBe("warning");
    expect(notices.messages().at(-1)?.message).toContain(
      "Do not submit it again",
    );
  });
  it("clears stale state and blocks further writes after an ambiguous network failure", async () => {
    await connect();
    const pending = workspace.deleteSupplier(11);
    http.expectOne("/api/suppliers/11/").error(new ProgressEvent("error"));
    await expect(pending).rejects.toThrow("outcome");
    expect(workspace.suppliers()).toEqual([]);
    expect(workspace.canWrite()).toBe(false);
    await expect(workspace.deleteSupplier(11)).rejects.toThrow("write-scoped");
  });
  it("refreshes current records on a constraint/status conflict and preserves the error", async () => {
    await connect();
    const pending = workspace.transitionOrder(71, "Delivered");
    http
      .expectOne("/api/orders/71/deliver/")
      .flush(
        { detail: "Cannot deliver twice." },
        { status: 409, statusText: "Conflict" },
      );
    await Promise.resolve();
    flushSnapshot({ status: "Delivered", stock: 2 });
    await expect(pending).rejects.toThrow("Cannot deliver twice");
    expect(workspace.products()[0]?.stock_quantity).toBe(2);
  });
  it("honors read-only access and makes demo mode an explicit, separate choice", async () => {
    await connect({ canWrite: false });
    await expect(
      workspace.saveProduct({
        product_name: "No write",
        category: "",
        unit_price: 1,
      }),
    ).rejects.toThrow("write-scoped");
    await workspace.useDemo();
    expect(workspace.mode).toBe("demo");
    expect(workspace.suppliers().length).toBe(3);
    expect(api.connected()).toBe(false);
    workspace.useApi();
    expect(workspace.mode).toBe("api");
    expect(workspace.suppliers()).toEqual([]);
    expect(workspace.error()).toContain("not connected");
  });
  it("loads real order details and does not derive inventory changes in the client", async () => {
    await connect();
    const pending = workspace.loadOrder(71);
    http.expectOne("/api/orders/71/").flush({ ...order, status: "Delivered" });
    await pending;
    expect(workspace.orders()[0]?.status).toBe("Delivered");
    expect(workspace.products()[0]?.stock_quantity).toBe(0);
  });
  it("rejects malformed and unsafe decimal values rather than silently losing precision", () => {
    expect(() => decimalValue("not-money")).toThrow();
    expect(() => decimalValue("999999999999999999.99")).toThrow();
    expect(() => decimalValue("90071992547409.91")).toThrow();
    expect(decimalValue("12.50")).toBe(12.5);
  });
  it("treats an unreadable successful HTTP response as an ambiguous write", async () => {
    await connect();
    const request = vi
      .spyOn(TestBed.inject(HttpClient), "request")
      .mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 200,
              statusText: "OK",
              error: new SyntaxError("Invalid JSON"),
            }),
        ),
      );
    await expect(workspace.deleteSupplier(11)).rejects.toThrow(
      "could not be read",
    );
    expect(workspace.canWrite()).toBe(false);
    expect(workspace.suppliers()).toEqual([]);
    request.mockRestore();
  });
  it("does not restore records when an old detail response arrives after disconnect", async () => {
    await connect();
    const pending = workspace.loadOrder(71);
    const request = http.expectOne("/api/orders/71/");
    workspace.disconnect();
    request.flush(order);
    await pending;
    expect(workspace.orders()).toEqual([]);
    expect(workspace.canWrite()).toBe(false);
  });
  it('disables creating orders for a Viewer and transitions for a Buyer', async () => {
    await connect({canWrite:false});
    const harness=await RouterTestingHarness.create();
    const component=await harness.navigateByUrl('/orders',OrdersPage);
    expect(component.canCreate()).toBe(false);
    expect(component.canTransition()).toBe(false);
    await component.save();
    http.expectNone('/api/orders/');
    const pending=workspace.refresh();
    flushSnapshot({role:'buyer',capabilities:{manage_catalog:true,create_orders:true,transition_orders:false,delete_records:false}});
    await pending;
    expect(component.canCreate()).toBe(true);
    expect(component.canTransition()).toBe(false);
  });
  it('keeps the new order form and values after a server validation error', async () => {
    await connect();
    const harness=await RouterTestingHarness.create();
    const component=await harness.navigateByUrl('/orders?new=1&supplier=11&product=21',OrdersPage);
    const pending=component.save();
    http.expectOne('/api/orders/').flush({items:['Rejected test quantity']},{status:400,statusText:'Bad Request'});
    await pending;
    expect(component.formOpen()).toBe(true);
    expect(component.form.controls.supplier_id.value).toBe(11);
    expect(component.error()).toContain('Rejected test quantity');
    expect(component.saving()).toBe(false);
  });
  it('closes the form without a false success message when a committed create cannot refresh', async () => {
    await connect();
    const harness=await RouterTestingHarness.create();
    const component=await harness.navigateByUrl('/orders?new=1&supplier=11&product=21',OrdersPage);
    const pending=component.save();
    const request=http.expectOne('/api/orders/');
    expect(request.request.body.items[0]).toEqual({product_id:21,quantity:1});
    await component.save();
    http.expectNone('/api/orders/');
    request.flush(order);
    await Promise.resolve();
    flushSnapshot({fail:'/api/products/?page=1'});
    await pending;
    expect(component.formOpen()).toBe(false);
    expect(component.canCreate()).toBe(false);
    expect(component.selected()).toBeUndefined();
    expect(notices.messages().at(-1)?.kind).toBe('warning');
  });

});
