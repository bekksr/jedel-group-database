import { WorkspaceStatus } from './workspace-status';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Product, Supplier } from "../models";
import { Store } from "../store";

@Component({selector:"ng-component-products",
  imports: [WorkspaceStatus, DecimalPipe, FormsModule, RouterLink],
  template: `
    <h1>Products</h1><app-workspace-status />
    @if(data.permissions().manageCatalog) {
      <button [disabled]="busy() || data.loading()" (click)="edit()">New product</button>
      @if(formOpen()) {
        <form class="panel narrow" (ngSubmit)="save()">
          <h2>{{editingId === undefined ? 'New product' : 'Edit product'}}</h2>
          <label>Product name<input name="product_name" [(ngModel)]="draft.product_name" required maxlength="100"></label>
          <label>Category<input name="category" [(ngModel)]="draft.category" maxlength="50"></label>
          <label>Unit price<input name="unit_price" type="number" [(ngModel)]="draft.unit_price" required min="0" max="99999999.99" step="0.01"></label>
          <p>Stock changes only through confirmed deliveries.</p>
          <button [disabled]="busy() || data.loading()">Save product</button>
          <button type="button" [disabled]="busy()" (click)="formOpen.set(false)">Cancel</button>
        </form>
      }
    }
    @if(error()) {<p class="error" role="alert">{{error()}}</p>}

    <p class="subtitle">Browse the catalog, check warehouse stock, and add items to a purchase order.</p>
    @if (data.loading()) {
      <p class="panel" role="status">Loading products…</p>
    } @else if (data.error()) {
      <p class="panel">Restore the business connection using Retry workspace above.</p>
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
            <div class="actions">@if(data.permissions().manageCatalog) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="edit(product)">Edit</button>}@if(data.permissions().deleteRecords) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="remove(product)">Delete</button>}</div>
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
  private readonly route = inject(ActivatedRoute);
  constructor() {
    let opened = false;
    effect(() => {
      if (!opened && this.route.snapshot.data?.['create'] && this.data.permissions().manageCatalog && !this.data.loading()) {
        opened = true; untracked(() => this.edit());
      }
    });
  }
  readonly busy = signal(false); readonly error = signal(''); readonly formOpen = signal(false);
  editingId?: number;
  draft = {product_name: '', category: '', unit_price: 0};
  edit(p?: Product) {
    if (this.busy() || !this.data.permissions().manageCatalog) return;
    this.editingId = p?.product_id;
    this.draft = p ? {product_name: p.product_name, category: p.category, unit_price: p.unit_price} : {product_name: '', category: '', unit_price: 0};
    this.error.set(''); this.formOpen.set(true);
  }
  async save() {
    if (this.busy() || this.data.loading()) return;
    this.busy.set(true); this.error.set('');
    try { await this.data.saveProduct(this.draft, this.editingId); this.formOpen.set(false); }
    catch(e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }
  async remove(p: Product) {
    if (this.busy() || !confirm('Delete product ' + p.product_name + '?')) return;
    this.busy.set(true); this.error.set('');
    try { await this.data.deleteProduct(p.product_id); } catch(e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }

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
