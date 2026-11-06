import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Store } from "../store";
@Component({
  imports: [FormsModule, RouterLink],
  template: `<h1>Suppliers</h1>
    <p class="subtitle">Find a supplier and start a purchase order.</p>
    <label class="search"
      >Search suppliers<input
        type="search"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
        placeholder="Name or city"
    /></label>
    <div class="cards">
      @for (s of filtered(); track s.supplier_id) {
        <article class="panel">
          <h2>{{ s.supplier_name }}</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{{ s.email }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ s.phone || "—" }}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{{ s.address || "—" }}</dd>
            </div>
          </dl>
          <a
            class="button secondary"
            routerLink="/orders"
            [queryParams]="{ new: 1, supplier: s.supplier_id }"
            >Choose supplier</a
          >
        </article>
      } @empty {
        <p class="panel">No suppliers match your search.</p>
      }
    </div>`,
})
export class SuppliersPage {
  readonly data = inject(Store);
  readonly query = signal("");
  readonly filtered = computed(() =>
    this.data
      .suppliers()
      .filter((s) =>
        (s.supplier_name + " " + s.address)
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
      ),
  );
}
