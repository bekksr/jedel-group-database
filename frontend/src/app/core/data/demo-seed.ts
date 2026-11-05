// Exact records from database/dumps/jedel_group_db.sql. No API fallback.
import { Supplier, Product, PurchaseOrder, OrderItem } from './models';
export const SEED_SUPPLIERS: readonly Supplier[] = [
  {
    supplier_id: 1,
    supplier_name: 'TechnoSupply',
    email: 'techno@example.com',
    phone: '+77010000001',
    address: 'Almaty',
  },
  {
    supplier_id: 2,
    supplier_name: 'Global Parts',
    email: 'global@example.com',
    phone: '+77010000002',
    address: 'Astana',
  },
  {
    supplier_id: 3,
    supplier_name: 'Smart Logistics',
    email: 'smart@example.com',
    phone: '+77010000003',
    address: 'Shymkent',
  },
];
export const SEED_PRODUCTS: readonly Product[] = [
  {
    product_id: 3,
    product_name: 'Wireless Keyboard',
    category: 'Accessories',
    unit_price: 12000.0,
    stock_quantity: 50,
  },
  {
    product_id: 4,
    product_name: 'Office Chair',
    category: 'Furniture',
    unit_price: 65000.0,
    stock_quantity: 12,
  },
  {
    product_id: 5,
    product_name: 'Network Router',
    category: 'Networking',
    unit_price: 45000.0,
    stock_quantity: 20,
  },
  {
    product_id: 1,
    product_name: 'Laptop Dell',
    category: 'Electronics',
    unit_price: 350000.0,
    stock_quantity: 17,
  },
  {
    product_id: 2,
    product_name: 'Office Monitor',
    category: 'Electronics',
    unit_price: 85000.0,
    stock_quantity: 33,
  },
];
export const SEED_PURCHASE_ORDERS: readonly PurchaseOrder[] = [
  {
    order_id: 2,
    supplier_id: 2,
    order_date: '2026-10-30',
    status: 'Approved',
    expected_delivery_date: '2026-11-04',
  },
  {
    order_id: 3,
    supplier_id: 3,
    order_date: '2026-10-30',
    status: 'Delivered',
    expected_delivery_date: '2026-10-30',
  },
  {
    order_id: 1,
    supplier_id: 1,
    order_date: '2026-10-30',
    status: 'Delivered',
    expected_delivery_date: '2026-11-06',
  },
];
export const SEED_PURCHASE_ORDER_ITEMS: readonly OrderItem[] = [
  {
    item_id: 1,
    order_id: 1,
    product_id: 1,
    quantity: 2,
    unit_price: 350000.0,
  },
  {
    item_id: 2,
    order_id: 1,
    product_id: 2,
    quantity: 3,
    unit_price: 85000.0,
  },
  {
    item_id: 3,
    order_id: 2,
    product_id: 3,
    quantity: 10,
    unit_price: 12000.0,
  },
  {
    item_id: 4,
    order_id: 2,
    product_id: 4,
    quantity: 4,
    unit_price: 65000.0,
  },
  {
    item_id: 5,
    order_id: 3,
    product_id: 3,
    quantity: 5,
    unit_price: 12000.0,
  },
  {
    item_id: 6,
    order_id: 3,
    product_id: 5,
    quantity: 5,
    unit_price: 45000.0,
  },
];
