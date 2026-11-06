import { computed, inject } from "@angular/core";
import { ERP_DATA, ORDER_STATUSES, orderTotal, Spending } from "./models";
export function useMetrics(source: "dashboard" | "analytics" = "dashboard") {
  const data = inject(ERP_DATA);
  const total = (id: number) =>
    data.mode === "api"
      ? (data.orders().find((o) => o.order_id === id)?.total ?? 0)
      : orderTotal(id, data.items());
  const activeOrders = computed(() =>
    data.orders().filter((o) => o.status !== "Cancelled"),
  );
  const purchasingValue = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.purchasingValue ?? 0)
      : activeOrders().reduce(
          (sum, o) => sum + Math.round(total(o.order_id) * 100),
          0,
        ) / 100,
  );
  const deliveredValue = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.deliveredValue ?? 0)
      : data
          .orders()
          .filter((o) => o.status === "Delivered")
          .reduce((sum, o) => sum + Math.round(total(o.order_id) * 100), 0) /
        100,
  );
  const spending = computed<readonly Spending[]>(() => {
    if (data.mode === "api")
      return source === "analytics"
        ? (data.supplierSpending?.() ?? [])
        : (data.dashboard?.()?.spending ?? []);
    return data
      .suppliers()
      .map((s) => {
        const orders = activeOrders().filter(
          (o) => o.supplier_id === s.supplier_id,
        );
        return {
          label: s.supplier_name,
          value:
            orders.reduce(
              (sum, o) => sum + Math.round(total(o.order_id) * 100),
              0,
            ) / 100,
          orders: orders.length,
        };
      })
      .sort((a, b) => b.value - a.value);
  });
  const statusCounts = computed(() =>
    data.mode === "api"
      ? source === "analytics"
        ? (data.orderStatuses?.() ?? [])
        : (data.dashboard?.()?.statuses ?? [])
      : ORDER_STATUSES.map((status) => ({
          status,
          count: data.orders().filter((o) => o.status === status).length,
        })),
  );
  const lowStock = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.lowStock ?? [])
      : data
          .products()
          .filter((p) => p.stock_quantity <= data.lowStockThreshold()),
  );
  const stockUnits = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.stockUnits ?? 0)
      : data.products().reduce((sum, p) => sum + p.stock_quantity, 0),
  );
  const supplierCount = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.supplierCount ?? 0)
      : data.suppliers().length,
  );
  const productCount = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.productCount ?? 0)
      : data.products().length,
  );
  const orderCount = computed(() =>
    data.mode === "api"
      ? (data.dashboard?.()?.orderCount ?? 0)
      : data.orders().length,
  );
  return {
    data,
    total,
    purchasingValue,
    deliveredValue,
    spending,
    statusCounts,
    lowStock,
    stockUnits,
    supplierCount,
    productCount,
    orderCount,
  };
}
