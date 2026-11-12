import { WorkspaceStatus } from './workspace-status';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Product } from "../models";
import { Store } from "../store";
@Component({selector: "ng-component-products",
  imports: [WorkspaceStatus, DecimalPipe, FormsModule, RouterLink],
  template: `<h1>Products</h1><app-workspace-status />
    <p class="subtitle">Product details, prices and current warehouse stock.</p>
    <label class="search"
      >Search products<input
        type="search"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
        placeholder="Name or category"
    /></label>
    <label>Category<select [ngModel]="category()" (ngModelChange)="category.set($event)"><option value="">All categories</option>@for(c of categories(); track c) {<option [value]="c">{{c}}</option>}</select></label>
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
    <div class="cards">
      @for (p of filtered(); track p.product_id) {
        <article class="panel">
          <p class="eyebrow">{{ p.category || "Uncategorized" }}</p>
          <h2>{{ p.product_name }}</h2>
          @if(data.permissions().manageCatalog) {<button [disabled]="busy() || data.loading()" (click)="edit(p)">Edit</button>}
          @if(data.permissions().deleteRecords) {<button [disabled]="busy() || data.loading()" (click)="remove(p)">Delete</button>}
          <dl>
            <div>
              <dt>Product ID</dt>
              <dd>#{{ p.product_id }}</dd>
            </div>
            <div>
              <dt>Unit price</dt>
              <dd>{{ p.unit_price | number: "1.2-2" }} ₸</dd>
            </div>
            <div>
              <dt>Warehouse stock</dt>
              <dd>{{ p.stock_quantity }} units</dd>
            </div>
          </dl>
          @if(data.permissions().createOrders) {
          <a
            class="button secondary"
            routerLink="/orders"
            [queryParams]="{ new: 1, product: p.product_id }"
            >Order this product</a
          >
          }
        </article>
      } @empty {
        @if(!data.loading() && !data.error()) {<p class="panel">No products match your search.</p>}
      }
    </div>`,
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
  readonly data = inject(Store);
  readonly query = signal("");
  readonly category = signal(''); readonly categories = computed(() => [...new Set(this.data.products().map(p => p.category).filter(Boolean))].sort());
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
  readonly filtered = computed(() =>
    this.data
      .products()
      .filter(p => !this.category() || p.category === this.category())
      .filter((p) =>
        (p.product_name + " " + p.category)
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
      ),
  );
}
