import { InjectionToken, Signal } from '@angular/core';
export type OrderStatus = 'Pending' | 'Approved' | 'Delivered' | 'Cancelled';
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'Pending',
  'Approved',
  'Delivered',
  'Cancelled',
];
export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  email: string;
  phone: string;
  address: string;
}
export interface Product {
  product_id: number;
  product_name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
}
export interface DashboardData {
  supplierCount: number;
  productCount: number;
  orderCount: number;
  purchasingValue: number;
  deliveredValue: number;
  stockUnits: number;
  lowStock: readonly Product[];
  recentOrders: readonly PurchaseOrder[];
  spending: readonly Spending[];
  statuses: readonly { status: OrderStatus; count: number }[];
}
export interface OrderItem {
  item_id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total?: number;
}
export interface PurchaseOrder {
  order_id: number;
  supplier_id: number;
  order_date: string;
  status: OrderStatus;
  total?: number;
  expected_delivery_date: string | null;
}
export interface OrderDraft {
  supplier_id: number;
  order_date: string;
  expected_delivery_date: string | null;
  items: { product_id: number; quantity: number }[];
}
export interface Spending {
  label: string;
  value: number;
  orders: number;
}
export interface Capabilities {
  manageCatalog: boolean;
  createOrders: boolean;
  transitionOrders: boolean;
  deleteRecords: boolean;
}
export interface ErpData {
  readonly permissions?: Signal<Capabilities>;
  readonly mode: 'demo' | 'api';
  readonly dashboard?: Signal<DashboardData | null>;
  readonly supplierSpending?: Signal<readonly Spending[]>;
  readonly orderStatuses?: Signal<readonly { status: OrderStatus; count: number }[]>;
  readonly busy?: Signal<boolean>;
  readonly canWrite?: Signal<boolean>;
  refresh?(): Promise<void>;
  loadOrder?(id: number): Promise<void>;
  deleteProduct?(id: number): void | Promise<void>;
  readonly suppliers: Signal<readonly Supplier[]>;
  readonly products: Signal<readonly Product[]>;
  readonly orders: Signal<readonly PurchaseOrder[]>;
  readonly items: Signal<readonly OrderItem[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string>;
  readonly lowStockThreshold: Signal<number>;
  saveSupplier(value: Omit<Supplier, 'supplier_id'>, id?: number): void | Promise<void>;
  deleteSupplier(id: number): void | Promise<void>;
  saveProduct(
    value: Omit<Product, 'product_id' | 'stock_quantity'>,
    id?: number,
  ): void | Promise<void>;
  createOrder(value: OrderDraft): number | Promise<number>;
  transitionOrder(id: number, status: OrderStatus): void | Promise<void>;
  setLowStockThreshold(value: number): void | Promise<void>;
  reset(): void;
}
export const ERP_DATA = new InjectionToken<ErpData>('ERP_DATA');
export function lineTotal(item: Pick<OrderItem, 'quantity' | 'unit_price'>): number {
  return (Math.round(item.unit_price * 100) * item.quantity) / 100;
}
export function orderTotal(id: number, items: readonly OrderItem[]): number {
  return (
    items
      .filter((i) => i.order_id === id)
      .reduce((sum, i) => sum + Math.round(lineTotal(i) * 100), 0) / 100
  );
}
export function allowedTransitions(status: OrderStatus): readonly OrderStatus[] {
  return status === 'Pending'
    ? ['Approved', 'Cancelled']
    : status === 'Approved'
      ? ['Delivered', 'Cancelled']
      : [];
}
export function localDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Qyzylorda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join('-');
}
