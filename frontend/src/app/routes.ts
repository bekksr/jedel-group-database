import { ConnectionPage } from "./pages/connection";
import { Routes } from "@angular/router";
import { HomePage } from "./pages/home";
import { ProductsPage } from "./pages/products";
import { SuppliersPage } from "./pages/suppliers";
import { OrdersPage } from "./pages/orders";
import { RegisterPage } from "./pages/register";
export const routes: Routes = [
  {
    path: "settings",
    component: ConnectionPage,
    title: "Connection | Jedel.Group",
  },
  { path: "", component: HomePage, title: "Home | Jedel.Group" },
  {
    path: "products",
    component: ProductsPage,
    title: "Products | Jedel.Group",
  },
  {
    path: "suppliers",
    component: SuppliersPage,
    title: "Suppliers | Jedel.Group",
  },
  { path: "orders", component: OrdersPage, title: "Orders | Jedel.Group" },
  {
    path: "register",
    component: RegisterPage,
    title: "Register | Jedel.Group",
  },
  { path: "dashboard", redirectTo: "", pathMatch: "full" },
  { path: "purchase-orders", redirectTo: "orders", pathMatch: "full" },
  { path: "**", redirectTo: "" },
];
