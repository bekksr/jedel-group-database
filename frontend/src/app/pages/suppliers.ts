import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Store } from "../store";

@Component({
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Suppliers</h1>
    <p class="subtitle">Search the directory and choose a supplier for your order.</p>
    @if (data.loading()) {
      <p class="panel" role="status">Loading suppliers…</p>
    } @else if (data.error()) {
      <p class="panel"><a routerLink="/settings">Connect to the API or open the demo</a> to browse suppliers.</p>
    } @else {
      <div class="catalog-toolbar">
        <label>Search suppliers
          <input
            type="search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            placeholder="Name, address, email, or phone"
          />
        </label>
        <p class="result-count" role="status">{{ filtered().length }} of {{ data.suppliers().length }} suppliers</p>
      </div>

      <div class="cards catalog-cards">
        @for (supplier of filtered(); track supplier.supplier_id) {
          <article class="panel catalog-card">
            <h2>{{ supplier.supplier_name }}</h2>
            <dl class="contact-details">
              <div><dt>Address</dt><dd>{{ supplier.address || "Not listed" }}</dd></div>
              <div><dt>Email</dt><dd>{{ supplier.email }}</dd></div>
              <div><dt>Phone</dt><dd>{{ supplier.phone || "Not listed" }}</dd></div>
            </dl>
            @if (canOrder()) {
              <a class="button secondary card-action" routerLink="/orders" [queryParams]="{ new: 1, supplier: supplier.supplier_id }">
                Choose supplier
              </a>
            }
          </article>
        } @empty {
          <div class="panel empty-state">
            @if (query()) {
              <p>No suppliers match your search.</p>
              <button type="button" class="secondary" (click)="query.set('')">Clear search</button>
            } @else {
              <p>No suppliers are available in this workspace.</p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class SuppliersPage {
  readonly data = inject(Store);
  readonly query = signal("");
  readonly canOrder = computed(() => this.data.canWrite() && this.data.permissions().createOrders);
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.data.suppliers().filter((supplier) =>
      [supplier.supplier_name, supplier.address, supplier.email, supplier.phone]
        .some((field) => field.toLowerCase().includes(query)),
    );
  });
}
