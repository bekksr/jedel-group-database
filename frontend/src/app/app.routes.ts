import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard | Jedel.Group ERP',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'suppliers',
    title: 'Suppliers | Jedel.Group ERP',
    loadComponent: () => import('./features/suppliers/suppliers.page').then((m) => m.SuppliersPage),
  },
  {
    path: 'products',
    title: 'Products | Jedel.Group ERP',
    loadComponent: () => import('./features/products/products.page').then((m) => m.ProductsPage),
  },
  {
    path: 'purchase-orders',
    title: 'Purchase Orders | Jedel.Group ERP',
    loadComponent: () =>
      import('./features/purchase-orders/purchase-orders.page').then((m) => m.PurchaseOrdersPage),
  },
  {
    path: 'analytics',
    title: 'Analytics | Jedel.Group ERP',
    loadComponent: () => import('./features/analytics/analytics.page').then((m) => m.AnalyticsPage),
  },
  {
    path: 'settings',
    title: 'Settings | Jedel.Group ERP',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
