import { DemoDataService } from "./demo-data.service";
import { orderTotal } from "./models";

describe("Explicit SQL demo data store", () => {
  let data: DemoDataService;
  beforeEach(() => {
    data = new DemoDataService();
  });
  it("uses the original SQL snapshot and derives exact purchasing totals", () => {
    expect([
      data.suppliers().length,
      data.products().length,
      data.orders().length,
      data.items().length,
    ]).toEqual([3, 5, 3, 6]);
    expect(
      data
        .orders()
        .reduce((sum, o) => sum + orderTotal(o.order_id, data.items()), 0),
    ).toBe(1620000);
    expect(data.products().reduce((sum, p) => sum + p.stock_quantity, 0)).toBe(
      132,
    );
  });
  it("does not replay stock changes for historical Delivered orders", () => {
    expect(
      data.products().find((p) => p.product_id === 1)?.stock_quantity,
    ).toBe(17);
    expect(() => data.transitionOrder(1, "Delivered")).toThrow();
    expect(
      data.products().find((p) => p.product_id === 1)?.stock_quantity,
    ).toBe(17);
  });
  it("delivers only after approval and adds stock exactly once", () => {
    const id = data.createOrder({
      supplier_id: 1,
      order_date: "2026-11-06",
      expected_delivery_date: null,
      items: [{ product_id: 1, quantity: 2 }],
    });
    expect(() => data.transitionOrder(id, "Delivered")).toThrow();
    data.transitionOrder(id, "Approved");
    data.transitionOrder(id, "Delivered");
    expect(
      data.products().find((p) => p.product_id === 1)?.stock_quantity,
    ).toBe(19);
    expect(() => data.transitionOrder(id, "Delivered")).toThrow();
    expect(() => data.transitionOrder(id, "Cancelled")).toThrow();
  });
  it("rejects duplicate lines, invalid quantities, and invalid dates atomically", () => {
    const draft = {
      supplier_id: 1,
      order_date: "2026-11-06",
      expected_delivery_date: null,
      items: [{ product_id: 1, quantity: 1 }],
    };
    expect(() =>
      data.createOrder({ ...draft, items: [...draft.items, ...draft.items] }),
    ).toThrow();
    expect(() =>
      data.createOrder({ ...draft, items: [{ product_id: 1, quantity: 1.5 }] }),
    ).toThrow();
    expect(() =>
      data.createOrder({ ...draft, expected_delivery_date: "2026-11-05" }),
    ).toThrow();
    expect(() =>
      data.createOrder({ ...draft, order_date: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      data.createOrder({
        ...draft,
        items: [{ product_id: 1, quantity: 2147483647 }],
      }),
    ).toThrow();
    expect(data.orders().length).toBe(3);
    expect(data.items().length).toBe(6);
  });
  it("preserves captured prices when the product catalog changes", () => {
    data.saveProduct(
      {
        product_name: "Laptop Dell",
        category: "Electronics",
        unit_price: 400000,
      },
      1,
    );
    expect(orderTotal(1, data.items())).toBe(955000);
    expect(
      data.products().find((p) => p.product_id === 1)?.stock_quantity,
    ).toBe(17);
  });
  it("prevents supplier email collisions and deleting referenced suppliers", () => {
    expect(() =>
      data.saveSupplier({
        supplier_name: "Test entry",
        email: "TECHNO@example.com",
        phone: "",
        address: "",
      }),
    ).toThrow();
    expect(() => data.deleteSupplier(1)).toThrow();
    data.saveSupplier({
      supplier_name: "Test entry",
      email: "test@example.com",
      phone: "",
      address: "",
    });
    data.deleteSupplier(4);
    expect(data.suppliers().length).toBe(3);
  });
  it("keeps product stock out of catalog editing and validates precision", () => {
    data.saveProduct({
      product_name: "Test product",
      category: "",
      unit_price: 12.5,
    });
    expect(data.products().at(-1)?.stock_quantity).toBe(0);
    expect(() =>
      data.saveProduct({
        product_name: "Invalid",
        category: "",
        unit_price: -1,
      }),
    ).toThrow();
    expect(() =>
      data.saveProduct({
        product_name: "Invalid",
        category: "",
        unit_price: 1.001,
      }),
    ).toThrow();
  });
  it("cancels orders without changing stock and forbids reopening", () => {
    data.transitionOrder(2, "Cancelled");
    expect(
      data.products().find((p) => p.product_id === 3)?.stock_quantity,
    ).toBe(50);
    expect(() => data.transitionOrder(2, "Approved")).toThrow();
  });
  it("resets every in-memory change to the SQL baseline", () => {
    data.setLowStockThreshold(5);
    data.transitionOrder(2, "Delivered");
    data.reset();
    expect(data.lowStockThreshold()).toBe(20);
    expect(data.orders().find((o) => o.order_id === 2)?.status).toBe(
      "Approved",
    );
    expect(
      data.products().find((p) => p.product_id === 3)?.stock_quantity,
    ).toBe(50);
  });
});
