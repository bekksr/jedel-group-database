import { Component, computed, inject, signal } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Supplier } from "../models";
import { Store } from "../store";

@Component({
  imports: [DecimalPipe, FormsModule, RouterLink],
  template: `
    <h1>Products</h1>
    <p class="subtitle">Browse the catalog, check warehouse stock, and add items to a purchase order.</p>
    @if (data.loading()) {
      <p class="panel" role="status">Loading products…</p>
    } @else if (data.error()) {
      <p class="panel"><a routerLink="/settings">Connect to the API or open the demo</a> to browse products.</p>
    } @else {
      <div class="catalog-toolbar">
        <label>Search products
          <input
            type="search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            placeholder="Name, category, or description"
          />
        </label>
        <label>Category
          <select [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">All categories</option>
            @for (name of categories(); track name) {
              <option [value]="name">{{ name }}</option>
            }
          </select>
        </label>
        <p class="result-count" role="status">{{ filtered().length }} of {{ data.products().length }} products</p>
      </div>

      <div class="cards catalog-cards">
        @for (product of filtered(); track product.product_id) {
          <article class="panel catalog-card">
            <p class="category">{{ product.category || "Uncategorized" }}</p>
            <h2>{{ product.product_name }}</h2>
            <dl class="product-facts">
              <div><dt>Unit price</dt><dd class="money">{{ product.unit_price | number: "1.2-2" }} ₸</dd></div>
              <div><dt>Warehouse stock</dt><dd>{{ product.stock_quantity }} units</dd></div>
            </dl>
            <details class="product-details">
              <summary>Product details</summary>
              <div class="details-content">
                <p class="hint">Product #{{ product.product_id }}</p>
                <h3>Description</h3>
                <p>{{ product.description || "No description is available for this product." }}</p>
                <h3>Suppliers from purchase orders</h3>
                <ul class="supplier-history">
                  @for (supplier of purchasingSuppliers().get(product.product_id) ?? []; track supplier.supplier_id) {
                    <li>
                      @if (canOrder()) {
                        <a routerLink="/orders" [queryParams]="{ new: 1, product: product.product_id, supplier: supplier.supplier_id }">
                          Order from {{ supplier.supplier_name }}
                        </a>
                      } @else {
                        {{ supplier.supplier_name }}
                      }
                    </li>
                  } @empty {
                    <li>No supplier appears in this product’s purchase history.</li>
                  }
                </ul>
              </div>
            </details>
            @if (canOrder()) {
              <a class="button secondary card-action" routerLink="/orders" [queryParams]="{ new: 1, product: product.product_id }">
                Order this product
              </a>
            }
          </article>
        } @empty {
          <div class="panel empty-state">
            @if (query() || category()) {
              <p>No products match your filters.</p>
              <button type="button" class="secondary" (click)="query.set(''); category.set('')">Clear filters</button>
            } @else {
              <p>No products are available in this workspace.</p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ProductsPage {
  readonly data = inject(Store);
  readonly query = signal("");
  readonly category = signal("");
  readonly canOrder = computed(() => this.data.canWrite() && this.data.permissions().createOrders);
  readonly categories = computed(() =>
    [...new Set(this.data.products().map((product) => product.category).filter(Boolean))].sort(),
  );
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    return this.data.products().filter((product) =>
      (!category || product.category === category) &&
      [product.product_name, product.category, product.description ?? ""]
        .some((field) => field.toLowerCase().includes(query)),
    );
  });
  readonly purchasingSuppliers = computed(() => {
    const orderSuppliers = new Map(this.data.orders()
      .filter((order) => order.status !== "Cancelled")
      .map((order) => [order.order_id, order.supplier_id] as const));
    const suppliersById = new Map(this.data.suppliers().map((supplier) => [supplier.supplier_id, supplier] as const));
    const byProduct = new Map<number, Set<Supplier>>();
    for (const item of this.data.items()) {
      const supplier = suppliersById.get(orderSuppliers.get(item.order_id) ?? 0);
      if (!supplier) continue;
      const matches = byProduct.get(item.product_id) ?? new Set<Supplier>();
      matches.add(supplier);
      byProduct.set(item.product_id, matches);
    }
    return byProduct;
  });
}
