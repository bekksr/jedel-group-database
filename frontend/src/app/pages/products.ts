import { Component, computed, inject, signal } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Store } from "../store";
@Component({
  imports: [DecimalPipe, FormsModule, RouterLink],
  template: `<h1>Products</h1>
    <p class="subtitle">Product details, prices and current warehouse stock.</p>
    <label class="search"
      >Search products<input
        type="search"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
        placeholder="Name or category"
    /></label>
    <div class="cards">
      @for (p of filtered(); track p.product_id) {
        <article class="panel">
          <p class="eyebrow">{{ p.category || "Uncategorized" }}</p>
          <h2>{{ p.product_name }}</h2>
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
          <a
            class="button secondary"
            routerLink="/orders"
            [queryParams]="{ new: 1, product: p.product_id }"
            >Order this product</a
          >
        </article>
      } @empty {
        <p class="panel">No products match your search.</p>
      }
    </div>`,
})
export class ProductsPage {
  readonly data = inject(Store);
  readonly query = signal("");
  readonly filtered = computed(() =>
    this.data
      .products()
      .filter((p) =>
        (p.product_name + " " + p.category)
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
      ),
  );
}
