import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../store";
@Component({
  imports: [RouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">SUPPLIER & PURCHASING MANAGEMENT</p>
      <h1>Purchasing, made simple.</h1>
      <p>
        Browse products, choose a supplier and keep track of your purchase
        orders in one place.
      </p>
      <a class="button" routerLink="/orders" [queryParams]="{ new: 1 }"
        >Create an order</a
      ><a class="button secondary" routerLink="/products">Browse products</a>
    </section>
    @if (!data.error() && !data.loading()) {
      <section class="stats" aria-label="Overview">
        <article>
          <strong>{{ data.products().length }}</strong
          ><span>Products</span>
        </article>
        <article>
          <strong>{{ data.suppliers().length }}</strong
          ><span>Suppliers</span>
        </article>
        <article>
          <strong>{{ data.orders().length }}</strong
          ><span>Purchase orders</span>
        </article>
      </section>
    }
    <section class="panel">
      <h2>How it works</h2>
      <ol class="steps">
        <li>
          <strong>Choose a supplier</strong>
          <p>Review contact details and select who to order from.</p>
        </li>
        <li>
          <strong>Add products</strong>
          <p>Set quantities and check the estimated total.</p>
        </li>
        <li>
          <strong>Track your order</strong>
          <p>View order items, delivery date and current status.</p>
        </li>
      </ol>
    </section>
  `,
})
export class HomePage {
  readonly data = inject(Store);
}
