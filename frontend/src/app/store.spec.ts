import { describe, expect, it } from "vitest";
import { DemoDataService as Store } from "./core/data/demo-data.service";
import { OrderDraft, orderTotal } from "./models";
const draft = (): OrderDraft => ({
  supplier_id: 1,
  order_date: "2026-11-06",
  expected_delivery_date: "2026-11-07",
  items: [
    { product_id: 1, quantity: 2 },
    { product_id: 2, quantity: 3 },
  ],
});
describe("Purchase orders", () => {
  it("keeps the provided seed and calculates its totals", () => {
    const s = new Store();
    expect(s.products()).toHaveLength(5);
    expect(s.suppliers()).toHaveLength(3);
    expect(s.orders()).toHaveLength(3);
    expect(orderTotal(1, s.items())).toBe(955000);
  });
  it("creates an order with captured prices without changing stock", () => {
    const s = new Store();
    const before = s.products();
    const id = s.createOrder(draft());
    expect(s.orders().find((o) => o.order_id === id)?.status).toBe("Pending");
    expect(orderTotal(id, s.items())).toBe(955000);
    expect(s.products()).toEqual(before);
  });
  it.each([0, -1, 1.5, NaN, 2147483648])(
    "rejects invalid quantity %s atomically",
    (q) => {
      const s = new Store();
      const d = draft();
      d.items[0].quantity = q;
      expect(() => s.createOrder(d)).toThrow();
      expect(s.orders()).toHaveLength(3);
      expect(s.items()).toHaveLength(6);
    },
  );
  it("rejects duplicates and missing products or suppliers", () => {
    const s = new Store();
    const d = draft();
    d.items.push(d.items[0]);
    expect(() => s.createOrder(d)).toThrow();
    expect(() => s.createOrder({ ...draft(), supplier_id: 999 })).toThrow();
    expect(() =>
      s.createOrder({ ...draft(), items: [{ product_id: 999, quantity: 1 }] }),
    ).toThrow();
    expect(() => s.createOrder({ ...draft(), items: [] })).toThrow();
  });
  it("rejects impossible dates and delivery before order date", () => {
    const s = new Store();
    expect(() =>
      s.createOrder({ ...draft(), order_date: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      s.createOrder({ ...draft(), expected_delivery_date: "2026-11-05" }),
    ).toThrow();
  });
  it("requires approval and delivers only once", () => {
    const s = new Store();
    const id = s.createOrder(draft());
    const stock = s.products().find((p) => p.product_id === 1)!.stock_quantity;
    expect(() => s.transitionOrder(id, "Delivered")).toThrow();
    s.transitionOrder(id, "Approved");
    s.transitionOrder(id, "Delivered");
    expect(s.products().find((p) => p.product_id === 1)!.stock_quantity).toBe(
      stock + 2,
    );
    expect(() => s.transitionOrder(id, "Delivered")).toThrow();
    expect(() => s.transitionOrder(id, "Cancelled")).toThrow();
    expect(s.products().find((p) => p.product_id === 1)!.stock_quantity).toBe(
      stock + 2,
    );
  });
  it("cancels without changing stock and prevents reopening", () => {
    const s = new Store();
    const id = s.createOrder(draft());
    const before = s.products();
    s.transitionOrder(id, "Cancelled");
    expect(s.products()).toEqual(before);
    expect(() => s.transitionOrder(id, "Approved")).toThrow();
  });
});
