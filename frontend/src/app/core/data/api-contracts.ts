import { OrderStatus } from './models';
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface ApiSupplier {
  supplier_id: number;
  supplier_name: string;
  email: string;
  phone: string | null;
  address: string | null;
}
export interface ApiProduct {
  product_id: number;
  product_name: string;
  category: string | null;
  unit_price: string;
  stock_quantity: number;
}
export interface ApiItem {
  item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}
export interface ApiOrder {
  order_id: number;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  status: OrderStatus;
  expected_delivery_date: string | null;
  items: ApiItem[];
  total: string;
}
export interface ApiSpending {
  supplier_id: number;
  supplier_name: string;
  total: string;
  order_count: number;
}
export interface StatusCount {
  status: OrderStatus;
  count: number;
}
export interface ApiDashboard {
  currency: 'KZT';
  total_suppliers: number;
  total_products: number;
  total_purchase_orders: number;
  total_purchasing_value: string;
  delivered_order_value: string;
  status_distribution: StatusCount[];
  supplier_spending: ApiSpending[];
  recent_orders: ApiOrder[];
  stock_overview: {
    total_units: number;
    low_stock_threshold: number;
    low_stock_products: ApiProduct[];
  };
}
export interface ApiAccess {
  can_write: boolean;
  authentication: 'shared_bearer_token';
  role_based_security: boolean;
  role?: 'viewer' | 'buyer' | 'approver' | 'admin';
  capabilities?: {
    manage_catalog: boolean;
    create_orders: boolean;
    transition_orders: boolean;
    delete_records: boolean;
  };
}
