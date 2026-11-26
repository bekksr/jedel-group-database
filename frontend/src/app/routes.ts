import { AccessRequestPage } from './pages/access-prompt';
import { CopilotPage } from './pages/copilot';
import { AuthPage } from './pages/auth-page';
import { PasswordResetConfirmPage, PasswordResetRequestPage } from './pages/password-reset';
import { PublicWorkspacePage, AccessDeniedPage } from './pages/public-workspace';
import { capabilityGuard } from './auth';
import { accountGuard } from './auth';
import { Routes } from "@angular/router";
import { HomePage } from "./pages/home";
import { ProductsPage } from "./pages/products";
import { SuppliersPage } from "./pages/suppliers";
import { OrdersPage } from "./pages/orders";
const loadAccountPage = () => import('./pages/connection').then(module => module.ConnectionPage);
export const routes: Routes = [
  {path: 'ai-assistant', component: CopilotPage, canActivate: [capabilityGuard], data: {capability: 'read'}, title: 'Jedel AI | Jedel.Group'},
  {path: 'access', component: AccessRequestPage, canActivate: [accountGuard]},
  {path: 'profile', loadComponent: loadAccountPage, canActivate: [accountGuard], title: 'My Profile | Jedel.Group'},
  {path: 'access-denied', component: AccessDeniedPage},
  {path: 'analytics', component: PublicWorkspacePage, canActivate: [capabilityGuard], data: {capability: 'read', section: 'analytics'}},
  {path: 'products/new', component: ProductsPage, canActivate: [capabilityGuard], data: {capability: 'manage_catalog', create: true}},
  {path: 'suppliers/new', component: SuppliersPage, canActivate: [capabilityGuard], data: {capability: 'manage_catalog', create: true}},
  {path: 'orders/new', component: OrdersPage, canActivate: [capabilityGuard], data: {capability: 'create_orders', create: true}},
  {path: 'auth', component: AuthPage, title: 'Account | Jedel.Group'},
  {path: 'password-reset', component: PasswordResetRequestPage, title: 'Reset password | Jedel.Group'},
  {path: 'password-reset/confirm/:uid/:token', component: PasswordResetConfirmPage, title: 'Choose a new password | Jedel.Group'},
  {path: 'login', redirectTo: redirect => '/auth?mode=login' + (redirect.queryParams['returnTo'] ? '&returnTo=' + encodeURIComponent(redirect.queryParams['returnTo']) : '')},
  {path: 'settings', redirectTo: 'profile', pathMatch: 'full'},
  { path: "", component: HomePage, title: "Home | Jedel.Group" },
  {
    path: "products",
    component: PublicWorkspacePage, data: {section: 'products'},
    title: "Products | Jedel.Group",
  },
  {
    path: "suppliers",
    component: PublicWorkspacePage, data: {section: 'suppliers'},
    title: "Suppliers | Jedel.Group",
  },
  { path: "orders", component: PublicWorkspacePage, data: {section: 'orders'}, title: "Orders | Jedel.Group" },
  {path: 'register', redirectTo: redirect => '/auth?mode=register' + (redirect.queryParams['returnTo'] ? '&returnTo=' + encodeURIComponent(redirect.queryParams['returnTo']) : '')},
  { path: "dashboard", redirectTo: "", pathMatch: "full" },
  { path: "purchase-orders", redirectTo: "orders", pathMatch: "full" },
  { path: "**", redirectTo: "" },
];
