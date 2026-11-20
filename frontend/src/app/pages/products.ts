import { WorkspaceStatus } from './workspace-status';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Product, Supplier } from "../models";
import { Store } from "../store";
import { demoProductDescription, displayProductName, isDemoProduct, legacyProductDescription } from '../core/data/product-metadata';
import { UiLanguage } from '../core/ui-language';

@Component({selector:"ng-component-products",
  imports: [WorkspaceStatus, DecimalPipe, FormsModule, RouterLink],
  template: `
    <h1>{{ text('Products') }}</h1>
    <p class="subtitle">{{ text('Browse the catalog, check warehouse stock, and add items to a purchase order.') }}</p>
    <app-workspace-status />
    @if (data.permissions().manageCatalog) {
      <button class="catalog-create" [disabled]="busy() || data.loading()" (click)="edit()">{{ text('New product') }}</button>
      @if (formOpen()) {
        <form class="panel narrow catalog-form" (ngSubmit)="save()">
          <h2>{{ text(editingId === undefined ? 'New product' : 'Edit product') }}</h2>
          <label>{{ text('Product name') }}<input name="product_name" [(ngModel)]="draft.product_name" required maxlength="100"></label>
          <label>{{ text('Category') }}<input name="category" [(ngModel)]="draft.category" maxlength="50"></label>
          <label>{{ text('Unit price') }}<input name="unit_price" type="number" [(ngModel)]="draft.unit_price" required min="0" max="99999999.99" step="0.01"></label>
          <p>{{ text('Stock changes only through confirmed deliveries.') }}</p>
          <div class="actions">
            <button [disabled]="busy() || data.loading()">{{ text('Save product') }}</button>
            <button type="button" class="secondary" [disabled]="busy()" (click)="formOpen.set(false)">{{ text('Cancel') }}</button>
          </div>
        </form>
      }
    }
    @if(error()) {<p class="error" role="alert">{{ text(error()) }}</p>}

    @if (data.loading()) {
      <p class="panel" role="status">{{ text('Loading products...') }}</p>
    } @else if (data.error()) {
      <p class="panel">{{ text('Restore the business connection using Retry workspace above.') }}</p>
    } @else {
      <div class="catalog-toolbar">
        <div class="search-field">
          <label for="products-search">{{ text('Search products') }}</label>
          <div class="search-control">
            <input id="products-search" #productSearch type="search" [ngModel]="query()"
              (ngModelChange)="query.set($event)" [placeholder]="text('Name, category, or description')" />
            @if (query()) {
              <button type="button" class="secondary clear-search" [title]="text('Clear search')"
                [attr.aria-label]="text('Clear search')" (click)="query.set(''); productSearch.focus()">×</button>
            }
          </div>
        </div>
        <label>{{ text('Category') }}
          <select [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">{{ text('All categories') }}</option>
            @for (name of categories(); track name) {
              <option [value]="name">{{ name }}</option>
            }
          </select>
        </label>
        <p class="result-count" role="status">{{ text('{count} of {total} products', {count: filtered().length, total: data.products().length}) }}</p>
      </div>

      <div class="cards catalog-cards">
        @for (product of filtered(); track product.product_id) {
          <article class="panel catalog-card" [attr.data-demo]="isDemo(product.product_name) ? 'true' : null">
            <p class="category">{{ product.category || text('Uncategorized') }}</p>
            <h2>{{ displayName(product.product_name) }}</h2>
            <div class="actions">@if(data.permissions().manageCatalog) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="edit(product)">{{ text('Edit') }}</button>}@if(data.permissions().deleteRecords) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="remove(product)">{{ text('Delete') }}</button>}</div>
            <dl class="product-facts">
              <div><dt>{{ text('Unit price') }}</dt><dd class="money">{{ product.unit_price | number: "1.2-2" }} ₸</dd></div>
              <div><dt>{{ text('Warehouse stock') }}</dt><dd>{{ product.stock_quantity }} {{ text('units') }}</dd></div>
            </dl>
            <details class="product-details" [open]="openProductId() === product.product_id">
              <summary (click)="toggleDetails($event, product.product_id)">{{ text('Product details') }}</summary>
              <div class="details-content">
                <p class="hint">{{ text('Product #{id}', {id: product.product_id}) }}</p>
                <h3>{{ text('Description') }}</h3>
                <p>{{ description(product) || text('No description is available for this product.') }}</p>
                <h3>{{ text('Suppliers from purchase orders') }}</h3>
                <ul class="supplier-history">
                  @for (supplier of purchasingSuppliers().get(product.product_id) ?? []; track supplier.supplier_id) {
                    <li>
                      @if (canOrder()) {
                        <a routerLink="/orders" [queryParams]="{ new: 1, product: product.product_id, supplier: supplier.supplier_id }">
                          {{ text('Order from {supplier}', {supplier: supplier.supplier_name}) }}
                        </a>
                      } @else {
                        {{ supplier.supplier_name }}
                      }
                    </li>
                  } @empty {
                    <li>{{ text('No supplier appears in this product’s purchase history.') }}</li>
                  }
                </ul>
              </div>
            </details>
            @if (canOrder()) {
              <a class="button secondary card-action" routerLink="/orders" [queryParams]="{ new: 1, product: product.product_id }">
                {{ text('Order this product') }}
              </a>
            }
          </article>
        } @empty {
          <div class="panel empty-state">
            @if (query().trim() || category()) {
              <p>{{ text('No products match your filters.') }}</p>
              <button type="button" class="secondary" (click)="query.set(''); category.set('')">{{ text('Clear filters') }}</button>
            } @else {
              <p>{{ text('No products are available in this workspace.') }}</p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ProductsPage {
  readonly text = inject(UiLanguage).text;
  readonly displayName = displayProductName;
  readonly isDemo = isDemoProduct;
  readonly openProductId = signal<number | null>(null);
  description(product: Product) { return product.description || demoProductDescription(product.product_name) || legacyProductDescription(product.product_id, product.product_name, product.category); }
  toggleDetails(event: Event, id: number) { event.preventDefault(); this.openProductId.update(current => current === id ? null : id); }
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
  private editingPrefix = '';
  draft = {product_name: '', category: '', unit_price: 0};
  edit(p?: Product) {
    if (this.busy() || !this.data.permissions().manageCatalog) return;
    this.editingId = p?.product_id;
    this.editingPrefix = p?.product_name.match(/^(?:\[DEMO\]|\[JEDEL FICTIONAL\])\s+/)?.[0] ?? '';
    this.draft = p ? {product_name: displayProductName(p.product_name), category: p.category, unit_price: p.unit_price} : {product_name: '', category: '', unit_price: 0};
    this.error.set(''); this.formOpen.set(true);
  }
  async save() {
    if (this.busy() || this.data.loading()) return;
    this.busy.set(true); this.error.set('');
    try { await this.data.saveProduct({...this.draft, product_name: this.editingPrefix + this.draft.product_name}, this.editingId); this.formOpen.set(false); }
    catch(e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }
  async remove(p: Product) {
    if (this.busy() || !confirm(this.text('Delete product {name}?', {name: displayProductName(p.product_name)}))) return;
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
      [product.product_name, product.category, this.description(product) ?? ""]
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
